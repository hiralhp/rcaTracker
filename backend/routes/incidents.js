const express = require('express');
const db = require('../db');
const router = express.Router();

// GET /api/incidents  — list all with current RCA status
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT
      i.*,
      r.id        AS rca_id,
      r.status    AS rca_status,
      r.assigned_vp,
      r.assigned_csm,
      r.requested_at,
      r.published_at,
      sh.entered_at AS stage_entered_at
    FROM incidents i
    LEFT JOIN rca r ON r.incident_id = i.id
    LEFT JOIN stage_history sh
      ON sh.rca_id = r.id AND sh.stage = r.status AND sh.exited_at IS NULL
    ORDER BY i.incident_date DESC
  `).all();
  res.json(rows);
});

// GET /api/incidents/:id  — single incident + full RCA + history
router.get('/:id', (req, res) => {
  const incident = db.prepare(`SELECT * FROM incidents WHERE id = ?`).get(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });

  const rca = db.prepare(`SELECT * FROM rca WHERE incident_id = ?`).get(incident.id);
  if (rca) {
    rca.history = db.prepare(`
      SELECT * FROM stage_history WHERE rca_id = ? ORDER BY entered_at ASC
    `).all(rca.id);
  }

  res.json({ ...incident, rca });
});

// POST /api/incidents  — create incident + initial RCA
router.post('/', (req, res) => {
  const { title, severity, customer_name, incident_date, assigned_vp, assigned_csm } = req.body;
  if (!title || !severity || !customer_name || !incident_date) {
    return res.status(400).json({ error: 'title, severity, customer_name, incident_date required' });
  }
  if (!['Sev1', 'Sev0'].includes(severity)) {
    return res.status(400).json({ error: 'severity must be Sev1 or Sev0' });
  }

  const now = new Date().toISOString();

  const create = db.transaction(() => {
    const inc = db.prepare(`
      INSERT INTO incidents (title, severity, customer_name, incident_date, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(title, severity, customer_name, incident_date, now);

    const rca = db.prepare(`
      INSERT INTO rca (incident_id, status, requested_at, assigned_vp, assigned_csm, created_at)
      VALUES (?, 'requested', ?, ?, ?, ?)
    `).run(inc.lastInsertRowid, now, assigned_vp || null, assigned_csm || null, now);

    db.prepare(`
      INSERT INTO stage_history (rca_id, stage, entered_at, actor)
      VALUES (?, 'requested', ?, ?)
    `).run(rca.lastInsertRowid, now, assigned_csm || 'System');

    return { incidentId: inc.lastInsertRowid, rcaId: rca.lastInsertRowid };
  });

  const result = create();
  res.status(201).json(result);
});

module.exports = router;
