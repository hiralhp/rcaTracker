const express = require('express');
const db = require('../db');
const router = express.Router();

// Customer-facing milestones — deliberately hides internal workflow terminology.
// Impact Started and Impact Ended are always shown as complete once an RCA exists;
// the active step begins at Investigating.
const MILESTONES = [
  {
    key:     'impact_started',
    label:   'Impact started',
    subtext: 'The incident began and our team was notified',
    typical_duration: null,
    stages:  [],
  },
  {
    key:     'impact_ended',
    label:   'Impact ended',
    subtext: 'All impacted services have been restored',
    typical_duration: null,
    stages:  [],
  },
  {
    key:               'investigating',
    label_pending:     'Investigating',
    label_in_progress: 'Investigating',
    label_complete:    'Investigating',
    subtext_pending:    'Our team will begin a full root cause investigation',
    subtext_in_progress: "We're actively reviewing the issue and taking steps to prevent it from happening again.",
    subtext_complete:    "We reviewed the issue and took steps to prevent it from happening again.",
    typical_duration:  null,
    stages:            ['requested', 'ai_draft_ready'],
  },
  {
    key:               'communication_being_prepared',
    label_pending:     'Communication being prepared',
    label_in_progress: 'Communication being prepared',
    label_complete:    'Communication prepared',
    subtext_pending:    "We're drafting your communication and validating key details.",
    subtext_in_progress: "We're drafting your communication and validating key details.",
    subtext_complete:    "Draft has been created after verifying key details.",
    typical_duration:  'Usually takes 1–3 days',
    stages:            ['drafting', 'service_owner_review'],
  },
  {
    key:               'communication_in_final_review',
    label_pending:     'Communication in final review',
    label_in_progress: 'Communication in final review',
    label_complete:    'Communication in final review',
    subtext_pending:    'The communication is in final review and will be shared shortly.',
    subtext_in_progress: 'The communication is in final review and will be shared shortly.',
    subtext_complete:   'The communication has been reviewed.',
    typical_duration:  null,
    stages:            ['vp_svp_review', 'tech_writer_review', 'pr_legal_review'],
  },
  {
    key:               'communication_sent',
    label_pending:     'Communication sent',
    label_in_progress: 'Communication sent',
    label_complete:    'Communication sent',
    subtext_pending:    'The formal communication will be sent once ready',
    subtext_in_progress: 'The communication is being finalized',
    subtext_complete:   'The full incident communication has been sent',
    typical_duration:  null,
    stages:            ['published'],
  },
];

const STAGES_ORDER = ['requested', 'ai_draft_ready', 'drafting', 'service_owner_review', 'vp_svp_review', 'tech_writer_review', 'pr_legal_review', 'published'];

// Map an internal stage to the milestone index it belongs to.
// Indices 0 (impact_started) and 1 (impact_ended) are always complete — current starts at 2.
function stageToMilestoneIdx(stage) {
  if (['requested', 'ai_draft_ready'].includes(stage))          return 2; // Investigating
  if (['drafting', 'service_owner_review'].includes(stage))     return 3; // Communication Being Prepared
  if (['vp_svp_review', 'tech_writer_review', 'pr_legal_review'].includes(stage)) return 4; // Communication in Final Review
  return 5; // published → Communication Sent
}

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

// GET /api/portal — incident list for customer history page
router.get('/', (req, res) => {
  const { customer_name } = req.query;
  const base = `
    SELECT i.id, i.title, i.incident_date, i.severity,
           r.status AS rca_status, r.impacted_services,
           sh.exited_at AS impact_end_time
    FROM incidents i
    JOIN rca r ON r.incident_id = i.id
    LEFT JOIN stage_history sh ON sh.rca_id = r.id AND sh.stage = 'requested'
  `;
  const rows = customer_name
    ? db.prepare(base + `
        WHERE i.customer_name = ?
           OR (r.impacted_accounts IS NOT NULL AND EXISTS (
                SELECT 1 FROM json_each(r.impacted_accounts) j WHERE j.value = ?
              ))
        ORDER BY i.incident_date DESC
      `).all(customer_name, customer_name)
    : db.prepare(base + `ORDER BY i.incident_date DESC`).all();

  res.json(rows.map(r => {
    const status = r.rca_status === 'published' ? 'resolved'
                 : r.impact_end_time            ? 'out_of_impact'
                 : 'in_progress';
    return {
      id:              r.id,
      title:           r.title,
      incident_date:   r.incident_date,
      severity:        r.severity,
      status,
      impact_end_time: r.impact_end_time || null,
      services_count:  r.impacted_services ? JSON.parse(r.impacted_services).length : 0,
    };
  }));
});

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

  const avgDurations        = getAvgStageDurations();
  const rcaIsPublished      = rca.status === 'published';
  const currentMilestoneIdx = stageToMilestoneIdx(rca.status);

  const milestones = MILESTONES.map((m, idx) => {
    const isComplete   = (idx < currentMilestoneIdx) || rcaIsPublished;
    const isInProgress = idx === currentMilestoneIdx && !rcaIsPublished;

    const status = isComplete ? 'complete' : isInProgress ? 'in_progress' : 'pending';

    // Timestamps from stage history
    let completedAt = null;
    let startedAt   = null;
    for (const stage of m.stages) {
      const h = history.find(h => h.stage === stage);
      if (h) {
        if (!startedAt) startedAt = h.entered_at;
        if (h.exited_at) completedAt = h.exited_at;
      }
    }

    // Dynamic label + subtext
    const label = status === 'complete'    ? (m.label_complete    || m.label)
                : status === 'in_progress' ? (m.label_in_progress || m.label)
                : (m.label_pending || m.label);

    const subtext = status === 'complete'    ? (m.subtext_complete    || m.subtext)
                  : status === 'in_progress' ? (m.subtext_in_progress || m.subtext)
                  : (m.subtext_pending || m.subtext);

    // Estimate remaining hours
    let estimatedHoursRemaining = null;
    if (isInProgress && m.stages.length > 0) {
      const currentStageHist = history.find(h => h.stage === rca.status && !h.exited_at);
      if (currentStageHist) {
        const hoursInStage = (Date.now() - new Date(currentStageHist.entered_at).getTime()) / 3_600_000;
        const avgForStage  = avgDurations[rca.status] || 12;
        estimatedHoursRemaining = Math.max(0, avgForStage - hoursInStage);
      }
    } else if (!isComplete && !isInProgress && m.stages.length > 0) {
      estimatedHoursRemaining = m.stages.reduce((sum, s) => sum + (avgDurations[s] || 8), 0);
    }

    return {
      key:              m.key,
      label,
      subtext,
      typical_duration: m.typical_duration,
      status,
      started_at:   startedAt,
      completed_at: completedAt,
      estimated_hours_remaining: estimatedHoursRemaining !== null ? +estimatedHoursRemaining.toFixed(1) : null,
    };
  });

  // Estimated completion window across all non-complete milestones
  const remainingHours = milestones
    .filter(m => m.status !== 'complete')
    .reduce((sum, m) => sum + (m.estimated_hours_remaining || 0), 0);
  const windowLow  = Math.round(remainingHours * 0.8);
  const windowHigh = Math.round(remainingHours * 1.2);

  const requestedStage = history.find(h => h.stage === 'requested');
  const impactEndTime = requestedStage?.exited_at || null;
  const durationMinutes = impactEndTime
    ? Math.max(0, Math.round((new Date(impactEndTime) - new Date(incident.incident_date)) / 60_000))
    : null;

  res.json({
    incident_id:   incident.id,
    title:         incident.title,
    customer_name: incident.customer_name,
    incident_date: incident.incident_date,
    severity:      incident.severity,
    impact_start_time: incident.incident_date,
    impact_end_time:   impactEndTime,
    duration_minutes:  durationMinutes,
    current_status: rcaIsPublished ? 'complete' : 'in_progress',
    milestones,
    estimated_hours_remaining: { low: windowLow, high: windowHigh },
    published_at:      rca.published_at,
    impacted_services: rca.impacted_services ? JSON.parse(rca.impacted_services) : [],
  });
});

// POST /api/portal/:incident_id/subscribe
router.post('/:incident_id/subscribe', (req, res) => {
  const incident = db.prepare(`SELECT id FROM incidents WHERE id = ?`).get(req.params.incident_id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });

  const { email, channels = ['email'], preferences = ['incident_updates'], slack_webhook = null } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  db.prepare(`
    INSERT INTO subscriptions (incident_id, email, channels, preferences, slack_webhook)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(incident_id, email) DO UPDATE SET
      channels      = excluded.channels,
      preferences   = excluded.preferences,
      slack_webhook = excluded.slack_webhook
  `).run(incident.id, email, JSON.stringify(channels), JSON.stringify(preferences), slack_webhook);

  res.json({ ok: true });
});

module.exports = router;
