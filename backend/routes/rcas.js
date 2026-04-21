const express = require('express');
const db = require('../db');
const router = express.Router();

// Sev1 skips PR & Legal Review
const STAGES_SEV1 = ['requested', 'ai_draft_ready', 'drafting', 'service_owner_review', 'vp_svp_review', 'tech_writer_review', 'published'];
// Sev0 includes PR & Legal Review before publish
const STAGES_SEV0 = ['requested', 'ai_draft_ready', 'drafting', 'service_owner_review', 'vp_svp_review', 'tech_writer_review', 'pr_legal_review', 'published'];

function getStages(severity) {
  return severity === 'Sev0' ? STAGES_SEV0 : STAGES_SEV1;
}

const STAGE_TS_COL = {
  requested:            'requested_at',
  ai_draft_ready:       'ai_draft_ready_at',
  drafting:             'drafting_at',
  service_owner_review: 'service_owner_review_at',
  vp_svp_review:        'vp_svp_review_at',
  tech_writer_review:   'tech_writer_review_at',
  pr_legal_review:      'pr_legal_review_at',
  published:            'published_at',
};

// SLO thresholds per stage (hours)
const SLO_HOURS = {
  requested:            2,
  ai_draft_ready:       3,
  drafting:             8,
  service_owner_review: 24,
  vp_svp_review:        48,
  tech_writer_review:   24,
  pr_legal_review:      8,
};

// GET /api/rcas — list all RCAs with filtering
router.get('/', (req, res) => {
  const { severity, csm, slo_status, rca_type, search } = req.query;

  let rows = db.prepare(`
    SELECT
      r.*,
      i.title         AS incident_title,
      i.severity,
      i.customer_name,
      i.incident_date,
      sh.entered_at   AS stage_entered_at
    FROM rca r
    JOIN incidents i ON i.id = r.incident_id
    LEFT JOIN stage_history sh
      ON sh.rca_id = r.id AND sh.stage = r.status AND sh.exited_at IS NULL
    ORDER BY i.incident_date DESC
  `).all();

  if (severity && severity !== 'all') {
    rows = rows.filter(r => r.severity === severity);
  }
  if (csm && csm !== 'all') {
    rows = rows.filter(r => {
      if (r.assigned_csm === csm) return true;
      if (r.impacted_csms) {
        try { return JSON.parse(r.impacted_csms).includes(csm); } catch {}
      }
      return false;
    });
  }
  if (slo_status && slo_status !== 'all') {
    rows = rows.filter(r => computeSloStatus(r) === slo_status);
  }
  if (rca_type && rca_type !== 'all') {
    rows = rows.filter(r => r.rca_type === rca_type);
  }
  if (search) {
    const q = search.toLowerCase().trim();
    // Extract numeric ID from formats like "INC-42", "INC-0042", "inc-42"
    const incMatch = q.match(/^inc-?0*(\d+)$/);
    rows = rows.filter(r => {
      if (incMatch) return String(r.incident_id) === incMatch[1];
      return (
        String(r.id).includes(q) ||
        String(r.incident_id).includes(q) ||
        `inc-${String(r.incident_id).padStart(4, '0')}`.includes(q) ||
        (r.assigned_csm     || '').toLowerCase().includes(q) ||
        (r.customer_name    || '').toLowerCase().includes(q) ||
        (r.incident_title   || '').toLowerCase().includes(q) ||
        (r.impacted_csms    || '').toLowerCase().includes(q) ||
        (r.impacted_accounts|| '').toLowerCase().includes(q) ||
        (r.assigned_vp      || '').toLowerCase().includes(q)
      );
    });
  }

  res.json(rows.map(r => ({
    ...r,
    slo_status:        computeSloStatus(r),
    impacted_accounts: r.impacted_accounts  ? JSON.parse(r.impacted_accounts)  : [],
    impacted_csms:     r.impacted_csms      ? JSON.parse(r.impacted_csms)      : [],
    impacted_services: r.impacted_services  ? JSON.parse(r.impacted_services)  : [],
  })));
});

// GET /api/rcas/:id — single RCA with full history
router.get('/:id', (req, res) => {
  const rca = db.prepare(`
    SELECT r.*, i.title AS incident_title, i.severity, i.customer_name, i.incident_date
    FROM rca r JOIN incidents i ON i.id = r.incident_id
    WHERE r.id = ?
  `).get(req.params.id);

  if (!rca) return res.status(404).json({ error: 'RCA not found' });

  rca.history = db.prepare(`
    SELECT * FROM stage_history WHERE rca_id = ? ORDER BY entered_at ASC
  `).all(rca.id);

  const currentHistory = rca.history.find(h => h.stage === rca.status && !h.exited_at);
  rca.stage_entered_at = currentHistory ? currentHistory.entered_at : null;
  rca.slo_status         = computeSloStatus(rca);
  rca.impacted_accounts  = rca.impacted_accounts  ? JSON.parse(rca.impacted_accounts)  : [];
  rca.impacted_csms      = rca.impacted_csms      ? JSON.parse(rca.impacted_csms)      : [];
  rca.impacted_services  = rca.impacted_services  ? JSON.parse(rca.impacted_services)  : [];

  res.json(rca);
});

// PUT /api/rcas/:id/advance — move to next stage
router.put('/:id/advance', (req, res) => {
  const { actor, note } = req.body;
  const rca = db.prepare(`SELECT * FROM rca WHERE id = ?`).get(req.params.id);
  if (!rca) return res.status(404).json({ error: 'RCA not found' });

  const incident = db.prepare(`SELECT severity FROM incidents WHERE id = ?`).get(rca.incident_id);
  const STAGES = getStages(incident?.severity);

  const currentIdx = STAGES.indexOf(rca.status);
  if (currentIdx === -1 || currentIdx === STAGES.length - 1) {
    return res.status(400).json({ error: 'Already at final stage' });
  }

  const nextStage = STAGES[currentIdx + 1];
  const now = new Date().toISOString();

  const advance = db.transaction(() => {
    // Close current stage_history record
    const currentHistory = db.prepare(`
      SELECT * FROM stage_history WHERE rca_id = ? AND stage = ? AND exited_at IS NULL
    `).get(rca.id, rca.status);

    if (currentHistory) {
      const durationMinutes = Math.round(
        (new Date(now) - new Date(currentHistory.entered_at)) / 60_000
      );
      db.prepare(`
        UPDATE stage_history SET exited_at = ?, duration_minutes = ?, note = ?
        WHERE id = ?
      `).run(now, durationMinutes, note || null, currentHistory.id);
    }

    // Open new stage_history record
    db.prepare(`
      INSERT INTO stage_history (rca_id, stage, entered_at, actor, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(rca.id, nextStage, now, actor || 'System', null);

    // Update RCA status + timestamp
    const tsCol = STAGE_TS_COL[nextStage];
    db.prepare(`
      UPDATE rca SET status = ?, ${tsCol} = ?, notes = COALESCE(?, notes) WHERE id = ?
    `).run(nextStage, now, note || null, rca.id);
  });

  advance();

  const updated = db.prepare(`
    SELECT r.*, i.title AS incident_title, i.severity, i.customer_name, i.incident_date
    FROM rca r JOIN incidents i ON i.id = r.incident_id WHERE r.id = ?
  `).get(rca.id);
  updated.history = db.prepare(
    `SELECT * FROM stage_history WHERE rca_id = ? ORDER BY entered_at ASC`
  ).all(rca.id);

  updated.impacted_services = updated.impacted_services ? JSON.parse(updated.impacted_services) : [];
  res.json(updated);
});

// PATCH /api/rcas/:id — partial update (e.g. impacted_services)
router.patch('/:id', (req, res) => {
  const rca = db.prepare(`SELECT id FROM rca WHERE id = ?`).get(req.params.id);
  if (!rca) return res.status(404).json({ error: 'RCA not found' });

  const { impacted_services } = req.body;
  if (impacted_services !== undefined) {
    db.prepare(`UPDATE rca SET impacted_services = ? WHERE id = ?`)
      .run(JSON.stringify(impacted_services), rca.id);
  }
  res.json({ success: true });
});

// GET /api/rcas/meta/csms — list all unique CSMs (including from multi-customer impacted lists)
router.get('/meta/csms', (_req, res) => {
  const rows = db.prepare(`SELECT assigned_csm, impacted_csms FROM rca WHERE assigned_csm IS NOT NULL OR impacted_csms IS NOT NULL`).all();
  const set = new Set();
  for (const r of rows) {
    if (r.assigned_csm) set.add(r.assigned_csm);
    if (r.impacted_csms) {
      try { JSON.parse(r.impacted_csms).forEach(c => set.add(c)); } catch {}
    }
  }
  res.json([...set].sort());
});

function computeSloStatus(rca) {
  if (rca.status === 'published') return 'closed';
  const threshold = SLO_HOURS[rca.status];
  if (!threshold || !rca.stage_entered_at) return 'green';
  const hoursInStage = (Date.now() - new Date(rca.stage_entered_at).getTime()) / 3_600_000;
  const pct = hoursInStage / threshold;
  if (pct >= 1) return 'red';
  if (pct >= 0.75) return 'yellow';
  return 'green';
}

module.exports = router;
