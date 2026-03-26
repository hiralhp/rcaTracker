const express = require('express');
const db = require('../db');
const router = express.Router();

const STAGES = ['requested', 'drafting', 'ai_draft_ready', 'vp_review', 'tech_writer_review', 'legal_review', 'published'];

const STAGE_TS_COL = {
  requested: 'requested_at', drafting: 'drafting_at',
  ai_draft_ready: 'ai_draft_ready_at', vp_review: 'vp_review_at',
  tech_writer_review: 'tech_writer_review_at', legal_review: 'legal_review_at',
  published: 'published_at',
};

// SLA thresholds per stage (hours)
const SLA_HOURS = {
  requested: 2, drafting: 8, ai_draft_ready: 3,
  vp_review: 48, tech_writer_review: 24, legal_review: 8,
};

// GET /api/rcas — list all RCAs with filtering
router.get('/', (req, res) => {
  const { severity, csm, sla_status } = req.query;

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
    rows = rows.filter(r => r.assigned_csm === csm);
  }
  if (sla_status && sla_status !== 'all') {
    rows = rows.filter(r => computeSlaStatus(r) === sla_status);
  }

  res.json(rows.map(r => ({ ...r, sla_status: computeSlaStatus(r) })));
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
  rca.sla_status = computeSlaStatus(rca);

  res.json(rca);
});

// PUT /api/rcas/:id/advance — move to next stage
router.put('/:id/advance', (req, res) => {
  const { actor, note } = req.body;
  const rca = db.prepare(`SELECT * FROM rca WHERE id = ?`).get(req.params.id);
  if (!rca) return res.status(404).json({ error: 'RCA not found' });

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

  res.json(updated);
});

// GET /api/rcas/meta/csms — list all unique CSMs
router.get('/meta/csms', (_req, res) => {
  const csms = db.prepare(`SELECT DISTINCT assigned_csm FROM rca WHERE assigned_csm IS NOT NULL ORDER BY assigned_csm`).all();
  res.json(csms.map(r => r.assigned_csm));
});

function computeSlaStatus(rca) {
  if (rca.status === 'published') return 'closed';
  const threshold = SLA_HOURS[rca.status];
  if (!threshold || !rca.stage_entered_at) return 'green';
  const hoursInStage = (Date.now() - new Date(rca.stage_entered_at).getTime()) / 3_600_000;
  const pct = hoursInStage / threshold;
  if (pct >= 1) return 'red';
  if (pct >= 0.75) return 'yellow';
  return 'green';
}

module.exports = router;
