const express = require('express');
const db = require('../db');
const router = express.Router();

const STAGES = ['requested', 'drafting', 'ai_draft_ready', 'vp_review', 'tech_writer_review', 'legal_review'];

// SLA thresholds per stage (hours)
const SLA_HOURS = {
  requested: 2, drafting: 8, ai_draft_ready: 3,
  vp_review: 48, tech_writer_review: 24, legal_review: 8,
};

// GET /api/analytics/stage-averages?severity=all
router.get('/stage-averages', (req, res) => {
  const { severity } = req.query;

  let rows;
  if (severity && severity !== 'all') {
    rows = db.prepare(`
      SELECT sh.stage, sh.duration_minutes
      FROM stage_history sh
      JOIN rca r ON r.id = sh.rca_id
      JOIN incidents i ON i.id = r.incident_id
      WHERE sh.exited_at IS NOT NULL AND i.severity = ?
    `).all(severity);
  } else {
    rows = db.prepare(`
      SELECT stage, duration_minutes FROM stage_history WHERE exited_at IS NOT NULL
    `).all();
  }

  const grouped = {};
  for (const r of rows) {
    if (!STAGES.includes(r.stage)) continue;
    if (!grouped[r.stage]) grouped[r.stage] = [];
    grouped[r.stage].push(r.duration_minutes);
  }

  const result = STAGES.map(stage => {
    const vals = grouped[stage] || [];
    const avg  = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return {
      stage,
      label: stageLabel(stage),
      avg_hours: +(avg / 60).toFixed(2),
      count: vals.length,
      sla_threshold_hours: SLA_HOURS[stage] || null,
      exceeds_sla: SLA_HOURS[stage] ? avg / 60 > SLA_HOURS[stage] : false,
    };
  });

  res.json(result);
});

// GET /api/analytics/cycle-time?period=month&severity=all
router.get('/cycle-time', (req, res) => {
  const { period = 'month', severity } = req.query;

  let query = `
    SELECT r.id, r.requested_at, r.published_at, i.severity,
      (julianday(r.published_at) - julianday(r.requested_at)) * 24 AS cycle_hours
    FROM rca r
    JOIN incidents i ON i.id = r.incident_id
    WHERE r.status = 'published' AND r.published_at IS NOT NULL AND r.requested_at IS NOT NULL
  `;
  const params = [];
  if (severity && severity !== 'all') {
    query += ` AND i.severity = ?`;
    params.push(severity);
  }

  const rows = db.prepare(query).all(...params);

  // Group by period
  const buckets = {};
  for (const r of rows) {
    const d = new Date(r.published_at);
    const key = period === 'week'
      ? `${d.getUTCFullYear()}-W${isoWeek(d).toString().padStart(2, '0')}`
      : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(r.cycle_hours);
  }

  const result = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period_key, vals]) => ({
      period: period_key,
      avg_hours: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2),
      count: vals.length,
    }));

  res.json(result);
});

// GET /api/analytics/variance?severity=all
router.get('/variance', (req, res) => {
  const { severity } = req.query;

  let rows;
  if (severity && severity !== 'all') {
    rows = db.prepare(`
      SELECT sh.stage, sh.duration_minutes
      FROM stage_history sh
      JOIN rca r ON r.id = sh.rca_id
      JOIN incidents i ON i.id = r.incident_id
      WHERE sh.exited_at IS NOT NULL AND i.severity = ?
    `).all(severity);
  } else {
    rows = db.prepare(`
      SELECT stage, duration_minutes FROM stage_history WHERE exited_at IS NOT NULL
    `).all();
  }

  const grouped = {};
  for (const r of rows) {
    if (!STAGES.includes(r.stage)) continue;
    if (!grouped[r.stage]) grouped[r.stage] = [];
    grouped[r.stage].push(r.duration_minutes);
  }

  const result = STAGES.map(stage => {
    const vals = grouped[stage] || [];
    if (!vals.length) {
      return { stage, label: stageLabel(stage), avg_hours: 0, std_dev_hours: 0, cv_percent: 0, count: 0, sla_threshold_hours: SLA_HOURS[stage] || null };
    }
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - avg) ** 2, 0) / vals.length;
    const stdDev = Math.sqrt(variance);
    const cv = avg > 0 ? (stdDev / avg) * 100 : 0;
    return {
      stage,
      label: stageLabel(stage),
      avg_hours: +(avg / 60).toFixed(2),
      std_dev_hours: +(stdDev / 60).toFixed(2),
      cv_percent: +cv.toFixed(1),
      count: vals.length,
      sla_threshold_hours: SLA_HOURS[stage] || null,
    };
  });

  res.json(result);
});

// GET /api/analytics/sla-summary
router.get('/sla-summary', (req, res) => {
  const total = db.prepare(`SELECT COUNT(*) AS n FROM rca`).get().n;
  const published = db.prepare(`SELECT COUNT(*) AS n FROM rca WHERE status='published'`).get().n;
  const breached = db.prepare(`
    SELECT COUNT(*) AS n FROM stage_history sh
    JOIN rca r ON r.id = sh.rca_id
    WHERE sh.exited_at IS NOT NULL AND sh.stage = 'vp_review'
      AND sh.duration_minutes > ${48 * 60}
  `).get().n;
  res.json({ total, published, in_progress: total - published, vp_review_breaches: breached });
});

function stageLabel(s) {
  return {
    requested: 'Requested', drafting: 'Drafting',
    ai_draft_ready: 'AI Draft Ready', vp_review: 'VP Review',
    tech_writer_review: 'Tech Writer', legal_review: 'Legal Review',
  }[s] || s;
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
}

module.exports = router;
