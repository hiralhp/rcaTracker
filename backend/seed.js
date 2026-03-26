const db = require('./db');

// Clear existing data
db.exec(`
  DELETE FROM stage_history;
  DELETE FROM rca;
  DELETE FROM incidents;
`);
try {
  db.exec(`DELETE FROM sqlite_sequence WHERE name IN ('incidents','rca','stage_history');`);
} catch (e) { /* table may not exist yet */ }

// Deterministic PRNG (seed=42) for reproducible data
class PRNG {
  constructor(seed) { this.state = seed >>> 0; }
  next() {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
  between(min, max) { return min + this.next() * (max - min); }
  intBetween(min, max) { return Math.floor(min + this.next() * (max - min + 1)); }
  choice(arr) { return arr[Math.floor(this.next() * arr.length)]; }
}
const rand = new PRNG(42);

const STAGES = ['requested', 'drafting', 'ai_draft_ready', 'vp_review', 'tech_writer_review', 'legal_review', 'published'];

const STAGE_TIMESTAMP_COLS = {
  requested: 'requested_at',
  drafting: 'drafting_at',
  ai_draft_ready: 'ai_draft_ready_at',
  vp_review: 'vp_review_at',
  tech_writer_review: 'tech_writer_review_at',
  legal_review: 'legal_review_at',
  published: 'published_at',
};

const CUSTOMERS = [
  'Acme Corporation', 'TechFlow Industries', 'Global Dynamics',
  'NovaStar Ventures', 'Pacific Retail Group', 'MegaCorp International',
  'DataStream Analytics', 'CloudBase Systems', 'ApexTech Solutions',
  'Stellar Innovations', 'Vertex Partners', 'Quantum Systems',
];

const TITLES = [
  'Database connection pool exhaustion causing query timeouts',
  'CDN cache invalidation failure impacting static asset delivery',
  'Authentication service outage — SSO login failures',
  'Payment processing timeout during peak transaction hours',
  'API rate limiting misconfiguration blocking partner integrations',
  'Load balancer health check failure causing traffic imbalance',
  'DNS resolution failure for primary application domain',
  'Memory leak in analytics processing service',
  'Scheduled batch job processing delay exceeding 4 hours',
  'SSL/TLS certificate expiry causing HTTPS failures',
  'Elasticsearch cluster split-brain event',
  'Redis cache eviction storm causing database overload',
  'Kafka consumer lag spike delaying event processing',
  'Network partition between availability zones',
  'Deployment rollout causing elevated 500 error rate',
  'Storage volume exhaustion on logging cluster',
  'Third-party OAuth provider intermittent failures',
  'Configuration drift causing inconsistent API responses',
  'DDoS mitigation over-blocking legitimate traffic',
  'Database primary failover delayed beyond RPO threshold',
];

const VPS   = ['Sarah Chen', 'Michael Torres', 'David Kim', 'Rachel Patel'];
const CSMS  = ['Jake Wilson', 'Maria Santos', 'Tom Bradley', 'Lisa Chen', 'Chris Park'];
const ACTORS = [...VPS, ...CSMS];

// Stage duration ranges [min, max] in hours (for Sev2; Sev1 uses 0.55x multiplier)
const STAGE_DURATION_HOURS = {
  requested:          [0.3,  1.5],
  drafting:           [2,    8  ],
  ai_draft_ready:     [0.5,  3  ],
  vp_review:          [8,   72  ],  // known bottleneck
  tech_writer_review: [2,   16  ],
  legal_review:       [1,    8  ],
};

function getStageDurationHours(stage, severity, forceHigh = false) {
  const [min, max] = STAGE_DURATION_HOURS[stage];
  let base;
  if (forceHigh) {
    base = max * 0.85 + rand.between(0, max * 0.15);
  } else {
    base = rand.between(min, max);
  }
  return severity === 'Sev1' ? base * 0.55 : base;
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3_600_000);
}

const now = new Date('2026-03-26T12:00:00Z');
const sixMonthsAgo = new Date(now.getTime() - 180 * 86_400_000);

// 35 RCAs: [finalStageIndex, isHighVpReview, severity override]
// finalStageIndex 6 = published (closed)
const RCA_SPECS = [
  // 24 published (i=0..23)
  [6, false, 'Sev1'], [6, true,  'Sev2'], [6, false, 'Sev2'], [6, true,  'Sev1'],
  [6, false, 'Sev2'], [6, true,  'Sev2'], [6, false, 'Sev1'], [6, false, 'Sev2'],
  [6, true,  'Sev2'], [6, false, 'Sev1'], [6, false, 'Sev2'], [6, true,  'Sev2'],
  [6, false, 'Sev2'], [6, false, 'Sev1'], [6, true,  'Sev2'], [6, false, 'Sev2'],
  [6, false, 'Sev1'], [6, true,  'Sev1'], [6, false, 'Sev2'], [6, false, 'Sev2'],
  [6, true,  'Sev2'], [6, false, 'Sev1'], [6, false, 'Sev2'], [6, true,  'Sev2'],
  // 11 in-progress
  [0, false, 'Sev1'], // requested
  [0, false, 'Sev2'], // requested
  [1, false, 'Sev2'], // drafting
  [1, false, 'Sev1'], // drafting
  [2, false, 'Sev2'], // ai_draft_ready
  [3, false, 'Sev2'], // vp_review
  [3, true,  'Sev2'], // vp_review (high)
  [3, false, 'Sev1'], // vp_review
  [3, false, 'Sev2'], // vp_review
  [4, false, 'Sev2'], // tech_writer_review
  [5, false, 'Sev1'], // legal_review
];

const insertIncident = db.prepare(`
  INSERT INTO incidents (title, severity, customer_name, incident_date, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

const insertRca = db.prepare(`
  INSERT INTO rca (
    incident_id, status,
    requested_at, drafting_at, ai_draft_ready_at,
    vp_review_at, tech_writer_review_at, legal_review_at, published_at,
    assigned_vp, assigned_csm, notes, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertHistory = db.prepare(`
  INSERT INTO stage_history (rca_id, stage, entered_at, exited_at, duration_minutes, actor, note)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

let publishedCount = 0;

const run = db.transaction(() => {
  for (let i = 0; i < RCA_SPECS.length; i++) {
    const [maxStageIdx, highVp, severity] = RCA_SPECS[i];
    const isPublished = maxStageIdx === 6;

    // Determine incident date
    let incidentDate;
    if (isPublished) {
      // Spread evenly across the first 5.5 months (leave buffer for completion)
      const frac = publishedCount / 23;
      incidentDate = new Date(
        sixMonthsAgo.getTime() + frac * (now.getTime() - sixMonthsAgo.getTime() - 21 * 86_400_000)
      );
      publishedCount++;
    } else {
      // In-progress: 1–18 days ago
      incidentDate = addHours(now, -rand.between(24, 432));
    }

    const title    = TITLES[i % TITLES.length];
    const customer = CUSTOMERS[i % CUSTOMERS.length];
    const vp       = VPS[i % VPS.length];
    const csm      = CSMS[i % CSMS.length];

    const incResult = insertIncident.run(
      title, severity, customer,
      incidentDate.toISOString(),
      incidentDate.toISOString()
    );
    const incidentId = incResult.lastInsertRowid;

    // Compute stage entry times
    // stageTimes[si] = time RCA entered STAGES[si]
    const stageTimes = new Array(maxStageIdx + 1);
    stageTimes[0] = new Date(incidentDate);

    for (let si = 0; si < maxStageIdx; si++) {
      const stage = STAGES[si];
      const forceHigh = highVp && stage === 'vp_review';
      const dur = getStageDurationHours(stage, severity, forceHigh);
      stageTimes[si + 1] = addHours(stageTimes[si], dur);
    }

    // Build timestamp columns
    const tsMap = {
      requested_at: null, drafting_at: null, ai_draft_ready_at: null,
      vp_review_at: null, tech_writer_review_at: null, legal_review_at: null,
      published_at: null,
    };
    for (let si = 0; si <= maxStageIdx; si++) {
      tsMap[STAGE_TIMESTAMP_COLS[STAGES[si]]] = stageTimes[si].toISOString();
    }

    const rcaResult = insertRca.run(
      incidentId,
      STAGES[maxStageIdx],
      tsMap.requested_at,
      tsMap.drafting_at,
      tsMap.ai_draft_ready_at,
      tsMap.vp_review_at,
      tsMap.tech_writer_review_at,
      tsMap.legal_review_at,
      tsMap.published_at,
      vp, csm, null,
      incidentDate.toISOString()
    );
    const rcaId = rcaResult.lastInsertRowid;

    // Insert stage_history rows
    for (let si = 0; si <= maxStageIdx; si++) {
      const stage     = STAGES[si];
      const enteredAt = stageTimes[si];
      const exitedAt  = si < maxStageIdx ? stageTimes[si + 1] : null;
      const durationMinutes = exitedAt
        ? Math.round((exitedAt - enteredAt) / 60_000)
        : null;
      const actor = rand.choice(ACTORS);

      insertHistory.run(
        rcaId, stage,
        enteredAt.toISOString(),
        exitedAt ? exitedAt.toISOString() : null,
        durationMinutes,
        actor,
        null
      );
    }
  }
});

run();
console.log(`✅  Seeded ${RCA_SPECS.length} incidents (${publishedCount} published, ${RCA_SPECS.length - publishedCount} in-progress)`);
