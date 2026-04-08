const express = require('express');
const db = require('../db');
const router = express.Router();

// Map internal stages to customer-facing milestones
// Each milestone: { key, label, typical_duration, stages[] }
const MILESTONES = [
  { key: 'investigating',   label: 'Investigating',         typical_duration: 'Usually takes a few hours to 1 day', stages: ['requested', 'drafting'] },
  { key: 'root_cause',      label: 'Root Cause Identified', typical_duration: 'Usually takes a few hours',           stages: ['ai_draft_ready'] },
  { key: 'draft_in_review', label: 'Draft in Review',       typical_duration: 'Usually takes 2–4 days',              stages: ['vp_review', 'tech_writer_review', 'legal_review'] },
  { key: 'communication',   label: 'Communication Sent',    typical_duration: 'Usually takes less than 1 day',       stages: ['published'] },
];

const STAGES_ORDER = ['requested', 'drafting', 'ai_draft_ready', 'vp_review', 'tech_writer_review', 'legal_review', 'published'];

function stageToMilestoneIdx(stage) {
  for (let i = 0; i < MILESTONES.length; i++) {
    if (MILESTONES[i].stages.includes(stage)) return i;
  }
  return 0;
}

// Average historical stage durations in hours (precomputed at request time for estimates)
function getAvgStageDurations() {
  const rows = db.prepare(`
    SELECT stage, AVG(duration_minutes) as avg_min
    FROM stage_history
    WHERE exited_at IS NOT NULL
    GROUP BY stage
  `).all();
  const map = {};
  for (const r of rows) map[r.stage] = r.avg_min / 60;
  return map;
}

// GET /api/portal/:incident_id
router.get('/:incident_id', (req, res) => {
  const incident = db.prepare(`SELECT * FROM incidents WHERE id = ?`).get(req.params.incident_id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });

  const rca = db.prepare(`SELECT * FROM rca WHERE incident_id = ?`).get(incident.id);
  if (!rca) return res.status(404).json({ error: 'RCA not found for this incident' });

  const history = db.prepare(`
    SELECT stage, entered_at, exited_at, duration_minutes
    FROM stage_history WHERE rca_id = ? ORDER BY entered_at ASC
  `).all(rca.id);

  const avgDurations = getAvgStageDurations();
  const currentMilestoneIdx = stageToMilestoneIdx(rca.status);

  // Build milestone progress
  const milestones = MILESTONES.map((m, idx) => {
    const isComplete = idx < currentMilestoneIdx || rca.status === 'published';
    const isCurrent  = idx === currentMilestoneIdx && rca.status !== 'published';

    // When was this milestone entered / completed?
    let completedAt = null;
    let startedAt   = null;

    for (const stage of m.stages) {
      const h = history.find(h => h.stage === stage);
      if (h) {
        if (!startedAt) startedAt = h.entered_at;
        if (h.exited_at) completedAt = h.exited_at;
      }
    }

    // Estimate remaining time for current milestone
    let estimatedHoursRemaining = null;
    if (isCurrent) {
      const currentStageHistory = history.find(h => h.stage === rca.status && !h.exited_at);
      if (currentStageHistory) {
        const hoursInStage = (Date.now() - new Date(currentStageHistory.entered_at).getTime()) / 3_600_000;
        const avgForStage  = avgDurations[rca.status] || 12;
        estimatedHoursRemaining = Math.max(0, avgForStage - hoursInStage);
      }
    } else if (idx > currentMilestoneIdx) {
      // Future milestones: sum avg durations of their stages
      estimatedHoursRemaining = m.stages.reduce((sum, s) => sum + (avgDurations[s] || 8), 0);
    }

    return {
      key: m.key,
      label: m.label,
      typical_duration: m.typical_duration,
      status: isComplete ? 'complete' : isCurrent ? 'in_progress' : 'pending',
      started_at:   startedAt,
      completed_at: completedAt,
      estimated_hours_remaining: estimatedHoursRemaining !== null ? +estimatedHoursRemaining.toFixed(1) : null,
    };
  });

  // Estimated completion window (sum of remaining estimates + buffer ±20%)
  const remainingHours = milestones
    .filter(m => m.status !== 'complete')
    .reduce((sum, m) => sum + (m.estimated_hours_remaining || 0), 0);
  const windowLow  = Math.round(remainingHours * 0.8);
  const windowHigh = Math.round(remainingHours * 1.2);

  res.json({
    incident_id:  incident.id,
    customer_name: incident.customer_name,
    incident_date: incident.incident_date,
    severity: incident.severity,
    current_status: rca.status === 'published' ? 'complete' : 'in_progress',
    milestones,
    estimated_hours_remaining: { low: windowLow, high: windowHigh },
    published_at: rca.published_at,
  });
});

module.exports = router;
