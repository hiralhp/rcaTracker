const db = require('./db');

// Drop and recreate tables
db.exec(`
  DROP TABLE IF EXISTS stage_history;
  DROP TABLE IF EXISTS rca;
  DROP TABLE IF EXISTS incidents;
`);
db.exec(`
  CREATE TABLE incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('Sev1', 'Sev0')),
    customer_name TEXT NOT NULL,
    incident_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE rca (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id INTEGER NOT NULL REFERENCES incidents(id),
    status TEXT NOT NULL DEFAULT 'requested',
    requested_at TEXT,
    ai_draft_ready_at TEXT,
    drafting_at TEXT,
    service_owner_review_at TEXT,
    vp_svp_review_at TEXT,
    tech_writer_review_at TEXT,
    pr_legal_review_at TEXT,
    published_at TEXT,
    assigned_vp TEXT,
    assigned_csm TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    rca_type TEXT NOT NULL DEFAULT 'single' CHECK(rca_type IN ('single', 'multi')),
    impacted_accounts TEXT,
    impacted_csms TEXT,
    impacted_services TEXT
  );
  CREATE TABLE stage_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rca_id INTEGER NOT NULL REFERENCES rca(id),
    stage TEXT NOT NULL,
    entered_at TEXT NOT NULL,
    exited_at TEXT,
    duration_minutes INTEGER,
    actor TEXT,
    note TEXT
  );
`);
try {
  db.exec(`DELETE FROM sqlite_sequence WHERE name IN ('incidents','rca','stage_history');`);
} catch (e) { /* ok */ }

// ─── Deterministic PRNG ───────────────────────────────────────────────────────
class PRNG {
  constructor(seed) { this.state = seed >>> 0; }
  next() {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
  between(min, max) { return min + this.next() * (max - min); }
  intBetween(min, max) { return Math.floor(min + this.next() * (max - min + 1)); }
  choice(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  sample(arr, n) {
    const copy = [...arr];
    const result = [];
    const take = Math.min(n, copy.length);
    for (let i = 0; i < take; i++) {
      const j = i + Math.floor(this.next() * (copy.length - i));
      [copy[i], copy[j]] = [copy[j], copy[i]];
      result.push(copy[i]);
    }
    return result;
  }
}
const rand = new PRNG(42);

// ─── Static reference data ────────────────────────────────────────────────────
// Use Sev1 stage set for seed data (97%+ of seeded RCAs are Sev1)
const STAGES = ['requested', 'ai_draft_ready', 'drafting', 'service_owner_review', 'vp_svp_review', 'tech_writer_review', 'published'];

const STAGE_TIMESTAMP_COLS = {
  requested:            'requested_at',
  ai_draft_ready:       'ai_draft_ready_at',
  drafting:             'drafting_at',
  service_owner_review: 'service_owner_review_at',
  vp_svp_review:        'vp_svp_review_at',
  tech_writer_review:   'tech_writer_review_at',
  published:            'published_at',
};

const SLO_HOURS = {
  requested:            2,
  ai_draft_ready:       3,
  drafting:             8,
  service_owner_review: 24,
  vp_svp_review:        48,
  tech_writer_review:   24,
};

const STAGE_DURATION_HOURS = {
  requested:            [0.3,  1.5],
  ai_draft_ready:       [0.5,  3  ],
  drafting:             [6,   20  ],
  service_owner_review: [2,   24  ],
  vp_svp_review:        [8,   72  ],
  tech_writer_review:   [20,  60  ],
};

const STAGE_NOMINAL_HOURS = {
  requested:            0.5,
  ai_draft_ready:       1.5,
  drafting:             12,
  service_owner_review: 8,
  vp_svp_review:        24,
  tech_writer_review:   32,
};

// Per-title service mapping — matches prototype incident types to realistic services
const TITLE_SERVICES = {
  'Database connection pool exhaustion causing query timeouts':       ['Apex', 'Data Cloud', 'Salesforce Platform'],
  'CDN cache invalidation failure impacting static asset delivery':   ['Experience Cloud', 'Hyperforce', 'Lightning Platform'],
  'Authentication service outage — SSO login failures':              ['Salesforce Identity', 'Salesforce Platform', 'Single Sign-On (SSO)'],
  'Payment processing timeout during peak transaction hours':         ['Commerce Cloud', 'MuleSoft Anypoint Platform', 'Salesforce Platform'],
  'API rate limiting misconfiguration blocking partner integrations': ['External Services', 'MuleSoft Anypoint Platform', 'Platform Events', 'Salesforce Connect'],
  'Load balancer health check failure causing traffic imbalance':     ['Hyperforce', 'Sales Cloud', 'Salesforce Platform', 'Service Cloud'],
  'DNS resolution failure for primary application domain':            ['Experience Cloud', 'Hyperforce', 'Salesforce Platform'],
  'Memory leak in analytics processing service':                     ['Apex', 'CRM Analytics', 'Data Cloud', 'Salesforce Platform'],
  'Scheduled batch job processing delay exceeding 4 hours':          ['Apex', 'Flow Builder', 'Salesforce Platform'],
  'SSL/TLS certificate expiry causing HTTPS failures':               ['Hyperforce', 'Salesforce Platform', 'Shield'],
  'Elasticsearch cluster split-brain event':                         ['CRM Analytics', 'Data Cloud', 'Reports & Dashboards', 'Salesforce Platform'],
  'Redis cache eviction storm causing database overload':             ['Apex', 'Data Cloud', 'Sales Cloud', 'Salesforce Platform', 'Service Cloud'],
  'Kafka consumer lag spike delaying event processing':              ['Data Cloud', 'MuleSoft Anypoint Platform', 'Platform Events'],
  'Network partition between availability zones':                    ['Hyperforce', 'MuleSoft Anypoint Platform', 'Salesforce Platform', 'Slack'],
  'Deployment rollout causing elevated 500 error rate':              ['Apex', 'DevOps Center', 'Sales Cloud', 'Salesforce Platform', 'Service Cloud'],
  'Storage volume exhaustion on logging cluster':                    ['Hyperforce', 'Salesforce Platform', 'Shield'],
  'Third-party OAuth provider intermittent failures':                ['External Services', 'Salesforce Identity', 'Single Sign-On (SSO)'],
  'Configuration drift causing inconsistent API responses':          ['Apex', 'MuleSoft Anypoint Platform', 'Platform Events', 'Salesforce Platform'],
  'DDoS mitigation over-blocking legitimate traffic':                ['Experience Cloud', 'Hyperforce', 'Shield'],
  'Database primary failover delayed beyond RPO threshold':          ['Data Cloud', 'Hyperforce', 'Salesforce Platform'],
  'Webhook delivery failures causing downstream data loss':          ['MuleSoft Anypoint Platform', 'Platform Events', 'Salesforce Connect'],
  'Auto-scaling group misconfiguration during traffic spike':        ['Commerce Cloud', 'Hyperforce', 'Sales Cloud', 'Salesforce Platform', 'Service Cloud'],
  'Search index corruption requiring full rebuild':                  ['CRM Analytics', 'Data Cloud', 'Reports & Dashboards', 'Salesforce Platform'],
  'Message queue backlog causing SLO breach':                        ['MuleSoft Anypoint Platform', 'Platform Events', 'Salesforce Platform'],
  'Container orchestration failure causing pod evictions':           ['Heroku', 'Hyperforce', 'Salesforce Functions'],
  'Data pipeline ingestion delay exceeding 6 hours':                ['CRM Analytics', 'Data Cloud', 'MuleSoft Anypoint Platform', 'Tableau'],
  'Emergency patch deployment causing service degradation':          ['Apex', 'DevOps Center', 'Sales Cloud', 'Salesforce Platform', 'Service Cloud'],
  'Session token expiry misconfiguration locking out users':         ['Salesforce Identity', 'Salesforce Platform', 'Single Sign-On (SSO)'],
  'Monitoring alert fatigue causing missed critical signals':        ['Salesforce Platform', 'Shield'],
  'Multi-region replication lag exceeding acceptable threshold':     ['Data Cloud', 'Hyperforce', 'Salesforce Platform'],
};

const VPS = ['Sarah Chen', 'Michael Torres', 'David Kim', 'Rachel Patel', 'Emily Wong', 'James Carter'];

// ─── 100 CSMs ─────────────────────────────────────────────────────────────────
const CSM_FIRST = [
  'Jake','Maria','Tom','Lisa','Chris','Sarah','Michael','David','Rachel','Emily',
  'James','Amanda','Kevin','Jennifer','Brian','Jessica','Ryan','Ashley','Daniel','Megan',
  'Tyler','Lauren','Nathan','Stephanie','Jordan',
];
const CSM_LAST = [
  'Wilson','Santos','Bradley','Chen','Park','Johnson','Martinez','Thompson',
  'Garcia','Anderson','Taylor','Moore','Jackson','Harris','Lee','White',
  'Clark','Robinson','Lewis','Walker',
];
const CSMS = [];
outer: for (const last of CSM_LAST) {
  for (const first of CSM_FIRST) {
    CSMS.push(`${first} ${last}`);
    if (CSMS.length === 175) break outer;
  }
}

// ─── 300 customer companies (30 words × 10 types) ────────────────────────────
const CO_WORDS = [
  'Apex','Atlas','Azure','Blue','Bright','Cedar','Cloud','Core','Delta','Dynamic',
  'Edge','Falcon','Forge','Global','Harbor','Horizon','Icon','Iron','Jade','Kite',
  'Lumen','Maple','Matrix','Nexus','Nova','Oak','Onyx','Orbit','Pacific','Peak',
];
const CO_TYPES = [
  'Analytics','Capital','Corporation','Digital','Dynamics',
  'Group','Industries','Partners','Solutions','Systems',
];
const CUSTOMERS = [];
for (const t of CO_TYPES) {
  for (const w of CO_WORDS) {
    CUSTOMERS.push(`${w} ${t}`);
  }
}  // 300 exactly

// ─── 30 incident titles ───────────────────────────────────────────────────────
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
  'Webhook delivery failures causing downstream data loss',
  'Auto-scaling group misconfiguration during traffic spike',
  'Search index corruption requiring full rebuild',
  'Message queue backlog causing SLO breach',
  'Container orchestration failure causing pod evictions',
  'Data pipeline ingestion delay exceeding 6 hours',
  'Emergency patch deployment causing service degradation',
  'Session token expiry misconfiguration locking out users',
  'Monitoring alert fatigue causing missed critical signals',
  'Multi-region replication lag exceeding acceptable threshold',
];

const ACTORS = [...VPS, ...CSMS.slice(0, 20)];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStageDurationHours(stage, severity, forceHigh = false) {
  const range = STAGE_DURATION_HOURS[stage];
  if (!range) return 1;
  const [min, max] = range;
  const base = forceHigh
    ? max * 0.85 + rand.between(0, max * 0.15)
    : rand.between(min, max);
  return severity === 'Sev1' ? base * 0.55 : base;
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3_600_000);
}

// ─── Generate 1000 RCA specs ──────────────────────────────────────────────────
const TOTAL      = 200;
const PUBLISHED  = 70;
const MULTI_RATIO = 0.15;

const specs = [];

// 350 published
for (let i = 0; i < PUBLISHED; i++) {
  const isMulti = rand.next() < MULTI_RATIO;
  specs.push({
    maxStageIdx: 6,
    highVp:      rand.next() < 0.3,
    severity:    rand.next() < 0.98 ? 'Sev1' : 'Sev0',
    hoursInStage: 0,
    rcaType:     isMulti ? 'multi' : 'single',
    multiAccounts: isMulti ? rand.sample(CUSTOMERS, rand.intBetween(2, 4)) : null,
    multiCsms:   isMulti ? rand.sample(CSMS, rand.intBetween(2, 4)) : null,
  });
}

// 650 in-progress across all active stages
for (let i = 0; i < TOTAL - PUBLISHED; i++) {
  const stageIdx   = rand.intBetween(0, 5);
  const stageName  = STAGES[stageIdx];
  const threshold  = SLO_HOURS[stageName];
  const roll       = rand.next();
  let hours;
  if (stageName === 'drafting') {
    hours = threshold * rand.between(1.1, 3.0);                          // always breached
  } else if (roll < 0.25) {
    hours = threshold * rand.between(1.05, 2.5);                         // breached
  } else if (roll < 0.50) {
    hours = threshold * rand.between(0.75, 0.99);                        // at-risk
  } else {
    hours = threshold * rand.between(0.05, 0.74);                        // on-track
  }

  const isMulti = rand.next() < MULTI_RATIO;
  specs.push({
    maxStageIdx:  stageIdx,
    highVp:       stageIdx >= 3 && rand.next() < 0.3,
    severity:     rand.next() < 0.98 ? 'Sev1' : 'Sev0',
    hoursInStage: hours,
    rcaType:      isMulti ? 'multi' : 'single',
    multiAccounts: isMulti ? rand.sample(CUSTOMERS, rand.intBetween(2, 4)) : null,
    multiCsms:   isMulti ? rand.sample(CSMS, rand.intBetween(2, 4)) : null,
  });
}

// ─── COMPANY_CSM: each company always maps to the same CSM ───────────────────
const COMPANY_CSM = {};
{
  let cidx = 0;
  let csmCounter = 0;
  while (cidx < CUSTOMERS.length) {
    const groupSize = rand.intBetween(5, 20);
    const csm = CSMS[csmCounter % CSMS.length];
    csmCounter++;
    for (let j = 0; j < groupSize && cidx < CUSTOMERS.length; j++, cidx++) {
      COMPANY_CSM[CUSTOMERS[cidx]] = csm;
    }
  }
}

// ─── Prepared statements ──────────────────────────────────────────────────────
const insertIncident = db.prepare(`
  INSERT INTO incidents (title, severity, customer_name, incident_date, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

const insertRca = db.prepare(`
  INSERT INTO rca (
    incident_id, status,
    requested_at, ai_draft_ready_at, drafting_at,
    service_owner_review_at, vp_svp_review_at, tech_writer_review_at, published_at,
    assigned_vp, assigned_csm, notes, created_at,
    rca_type, impacted_accounts, impacted_csms, impacted_services
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertHistory = db.prepare(`
  INSERT INTO stage_history (rca_id, stage, entered_at, exited_at, duration_minutes, actor, note)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// ─── Run transaction ──────────────────────────────────────────────────────────
const now          = new Date();
const sixMonthsAgo = new Date(now.getTime() - 180 * 86_400_000);

// Process published first so they're spread across the time window
const publishedSpecs = specs.filter(s => s.maxStageIdx === 6);
const activeSpecs    = specs.filter(s => s.maxStageIdx !== 6);
const orderedSpecs   = [...publishedSpecs, ...activeSpecs];

const activeCountPerCompany = {};

const run = db.transaction(() => {
  let publishedIdx = 0;

  for (let i = 0; i < orderedSpecs.length; i++) {
    let { maxStageIdx, highVp, severity, hoursInStage, rcaType, multiAccounts, multiCsms } = orderedSpecs[i];

    const customer = CUSTOMERS[i % CUSTOMERS.length];
    const vp       = VPS[i % VPS.length];
    // Single incidents: CSM is always the same for a given company; multi: lead from multiCsms
    const csm = rcaType === 'multi'
      ? (multiCsms && multiCsms.length > 0 ? multiCsms[0] : CSMS[i % CSMS.length])
      : COMPANY_CSM[customer];

    // Enforce max 2 active (non-published) incidents per single-customer company
    let forced = false;
    if (rcaType === 'single' && maxStageIdx < 6) {
      const count = activeCountPerCompany[customer] || 0;
      if (count >= 2) { maxStageIdx = 6; forced = true; }
      else { activeCountPerCompany[customer] = count + 1; }
    }

    const isPublished = maxStageIdx === 6;

    let incidentDate;
    if (isPublished && !forced) {
      const frac = publishedIdx / (publishedSpecs.length - 1 || 1);
      incidentDate = new Date(
        sixMonthsAgo.getTime() + frac * (now.getTime() - sixMonthsAgo.getTime() - 21 * 86_400_000)
      );
      publishedIdx++;
    } else {
      const prevHours = STAGES.slice(0, maxStageIdx)
        .reduce((sum, s) => sum + (STAGE_NOMINAL_HOURS[s] || 0), 0);
      incidentDate = addHours(now, -(hoursInStage + prevHours));
    }

    const title = TITLES[i % TITLES.length];

    const incResult = insertIncident.run(
      title, severity, customer,
      incidentDate.toISOString(),
      incidentDate.toISOString()
    );
    const incidentId = incResult.lastInsertRowid;

    // Stage entry times
    const stageTimes = new Array(maxStageIdx + 1);
    stageTimes[0] = new Date(incidentDate);
    for (let si = 0; si < maxStageIdx; si++) {
      const stage = STAGES[si];
      const dur = isPublished
        ? getStageDurationHours(stage, severity, highVp && stage === 'vp_svp_review')
        : (STAGE_NOMINAL_HOURS[stage] || 1);
      stageTimes[si + 1] = addHours(stageTimes[si], dur);
    }

    // Timestamp map
    const tsMap = {
      requested_at: null, ai_draft_ready_at: null, drafting_at: null,
      service_owner_review_at: null, vp_svp_review_at: null,
      tech_writer_review_at: null, published_at: null,
    };
    for (let si = 0; si <= maxStageIdx; si++) {
      tsMap[STAGE_TIMESTAMP_COLS[STAGES[si]]] = stageTimes[si].toISOString();
    }

    // Services based on incident title; fall back to a small generic set
    const svcSample = TITLE_SERVICES[title] || ['Hyperforce', 'Salesforce Platform'];

    const rcaResult = insertRca.run(
      incidentId, STAGES[maxStageIdx],
      tsMap.requested_at, tsMap.ai_draft_ready_at, tsMap.drafting_at,
      tsMap.service_owner_review_at, tsMap.vp_svp_review_at,
      tsMap.tech_writer_review_at, tsMap.published_at,
      vp, csm, null, incidentDate.toISOString(),
      rcaType,
      multiAccounts ? JSON.stringify(multiAccounts) : null,
      multiCsms     ? JSON.stringify(multiCsms)     : null,
      JSON.stringify(svcSample)
    );
    const rcaId = rcaResult.lastInsertRowid;

    // Stage history
    for (let si = 0; si <= maxStageIdx; si++) {
      const enteredAt = stageTimes[si];
      const exitedAt  = si < maxStageIdx ? stageTimes[si + 1] : null;
      insertHistory.run(
        rcaId, STAGES[si],
        enteredAt.toISOString(),
        exitedAt ? exitedAt.toISOString() : null,
        exitedAt ? Math.round((exitedAt - enteredAt) / 60_000) : null,
        rand.choice(ACTORS),
        null
      );
    }
  }
});

run();

// ─── Guarantee Jake Wilson has 1 single + 1 multi active incident ─────────────
const jakeNow = new Date();
const jakeIncident1 = insertIncident.run(
  'Redis cache eviction storm causing database overload',
  'Sev1', 'Horizon Systems',
  addHours(jakeNow, -12).toISOString(),
  addHours(jakeNow, -12).toISOString()
);
const jakeRca1 = insertRca.run(
  jakeIncident1.lastInsertRowid, 'drafting',
  addHours(jakeNow, -12).toISOString(), addHours(jakeNow, -11).toISOString(), addHours(jakeNow, -10).toISOString(),
  null, null, null, null,
  'Sarah Chen', 'Jake Wilson', null, addHours(jakeNow, -12).toISOString(),
  'single', null, null,
  JSON.stringify(['Sales Cloud', 'Service Cloud', 'Flow Automation'])
);
insertHistory.run(jakeRca1.lastInsertRowid, 'requested',      addHours(jakeNow, -12).toISOString(), addHours(jakeNow, -11).toISOString(), 60,  'Jake Wilson', null);
insertHistory.run(jakeRca1.lastInsertRowid, 'ai_draft_ready', addHours(jakeNow, -11).toISOString(), addHours(jakeNow, -10).toISOString(), 60,  'Jake Wilson', null);
insertHistory.run(jakeRca1.lastInsertRowid, 'drafting',       addHours(jakeNow, -10).toISOString(), null,                                null, 'Jake Wilson', null);

const jakeIncident2 = insertIncident.run(
  'Network partition between availability zones',
  'Sev1', 'Apex Analytics',
  addHours(jakeNow, -12).toISOString(),
  addHours(jakeNow, -12).toISOString()
);
const jakeRca2 = insertRca.run(
  jakeIncident2.lastInsertRowid, 'vp_svp_review',
  addHours(jakeNow, -12).toISOString(), addHours(jakeNow, -10).toISOString(), addHours(jakeNow, -8).toISOString(),
  addHours(jakeNow, -7).toISOString(), addHours(jakeNow, -6).toISOString(), null, null,
  'Sarah Chen', 'Jake Wilson', null, addHours(jakeNow, -12).toISOString(),
  'multi',
  JSON.stringify(['Apex Analytics', 'Nova Digital', 'Blue Capital']),
  JSON.stringify(['Jake Wilson', 'Maria Santos', 'Tom Bradley']),
  JSON.stringify(['Salesforce APIs', 'Platform Events', 'MuleSoft Anypoint Platform', 'Data Cloud'])
);
insertHistory.run(jakeRca2.lastInsertRowid, 'requested',            addHours(jakeNow, -12).toISOString(), addHours(jakeNow, -10).toISOString(), 120, 'Jake Wilson', null);
insertHistory.run(jakeRca2.lastInsertRowid, 'ai_draft_ready',       addHours(jakeNow, -10).toISOString(), addHours(jakeNow,  -8).toISOString(), 120, 'Jake Wilson', null);
insertHistory.run(jakeRca2.lastInsertRowid, 'drafting',             addHours(jakeNow,  -8).toISOString(), addHours(jakeNow,  -7).toISOString(),  60, 'Jake Wilson', null);
insertHistory.run(jakeRca2.lastInsertRowid, 'service_owner_review', addHours(jakeNow,  -7).toISOString(), addHours(jakeNow,  -6).toISOString(),  60, 'Maria Santos', null);
insertHistory.run(jakeRca2.lastInsertRowid, 'vp_svp_review',       addHours(jakeNow,  -6).toISOString(), null,                                  null, 'Sarah Chen', null);

console.log(`✅  Seeded ${TOTAL} incidents (${PUBLISHED} published, ${TOTAL - PUBLISHED} in-progress, ~${Math.round(TOTAL * MULTI_RATIO)} multi-customer)`);
console.log('✅  Jake Wilson: 1 single active (drafting) + 1 multi active (vp_svp_review)');

// ─── Horizon Systems: 2 additional published incidents (demo) ─────────────────
const hBase1 = addHours(new Date(), -30 * 24);   // ~30 days ago
const hBase2 = addHours(new Date(), -62 * 24);   // ~62 days ago

// ── Incident 1: Sev1 — API gateway outage ────────────────────────────────────
const h1t0 = hBase1;
const h1t1 = addHours(h1t0, 0.75);   // ai_draft_ready
const h1t2 = addHours(h1t1, 1.5);    // drafting
const h1t3 = addHours(h1t2, 5);      // service_owner_review
const h1t4 = addHours(h1t3, 10);     // vp_svp_review
const h1t5 = addHours(h1t4, 18);     // tech_writer_review
const h1t6 = addHours(h1t5, 8);      // published

const horizonInc1 = insertIncident.run(
  'API gateway timeout causing partner integration failures',
  'Sev1', 'Horizon Systems',
  hBase1.toISOString(), hBase1.toISOString()
);
const horizonRca1 = insertRca.run(
  horizonInc1.lastInsertRowid, 'published',
  h1t0.toISOString(), h1t1.toISOString(), h1t2.toISOString(),
  h1t3.toISOString(), h1t4.toISOString(), h1t5.toISOString(), h1t6.toISOString(),
  'David Kim', 'Jake Wilson', null, hBase1.toISOString(),
  'single', null, null,
  JSON.stringify(['External Services', 'MuleSoft Anypoint Platform', 'Platform Events', 'Salesforce Connect'])
);
insertHistory.run(horizonRca1.lastInsertRowid, 'requested',            h1t0.toISOString(), h1t1.toISOString(), Math.round((h1t1 - h1t0) / 60000), 'David Kim', null);
insertHistory.run(horizonRca1.lastInsertRowid, 'ai_draft_ready',       h1t1.toISOString(), h1t2.toISOString(), Math.round((h1t2 - h1t1) / 60000), 'David Kim', null);
insertHistory.run(horizonRca1.lastInsertRowid, 'drafting',             h1t2.toISOString(), h1t3.toISOString(), Math.round((h1t3 - h1t2) / 60000), 'Jake Wilson', null);
insertHistory.run(horizonRca1.lastInsertRowid, 'service_owner_review', h1t3.toISOString(), h1t4.toISOString(), Math.round((h1t4 - h1t3) / 60000), 'Jake Wilson', null);
insertHistory.run(horizonRca1.lastInsertRowid, 'vp_svp_review',       h1t4.toISOString(), h1t5.toISOString(), Math.round((h1t5 - h1t4) / 60000), 'David Kim', null);
insertHistory.run(horizonRca1.lastInsertRowid, 'tech_writer_review',   h1t5.toISOString(), h1t6.toISOString(), Math.round((h1t6 - h1t5) / 60000), 'David Kim', null);
insertHistory.run(horizonRca1.lastInsertRowid, 'published',            h1t6.toISOString(), null, null, 'David Kim', null);

// ── Incident 2: Sev0 — Auth service failure (includes pr_legal_review) ────────
const h2t0 = hBase2;
const h2t1 = addHours(h2t0, 0.5);    // ai_draft_ready
const h2t2 = addHours(h2t1, 1);      // drafting
const h2t3 = addHours(h2t2, 6);      // service_owner_review
const h2t4 = addHours(h2t3, 16);     // vp_svp_review
const h2t5 = addHours(h2t4, 36);     // tech_writer_review
const h2t6 = addHours(h2t5, 12);     // pr_legal_review
const h2t7 = addHours(h2t6, 8);      // published

const horizonInc2 = insertIncident.run(
  'Authentication service failure causing widespread login disruption',
  'Sev0', 'Horizon Systems',
  hBase2.toISOString(), hBase2.toISOString()
);
const horizonRca2 = insertRca.run(
  horizonInc2.lastInsertRowid, 'published',
  h2t0.toISOString(), h2t1.toISOString(), h2t2.toISOString(),
  h2t3.toISOString(), h2t4.toISOString(), h2t5.toISOString(), h2t7.toISOString(),
  'Rachel Patel', 'Jake Wilson', null, hBase2.toISOString(),
  'single', null, null,
  JSON.stringify(['Salesforce Identity', 'Salesforce Platform', 'Single Sign-On (SSO)'])
);
db.prepare('UPDATE rca SET pr_legal_review_at = ? WHERE id = ?').run(h2t6.toISOString(), horizonRca2.lastInsertRowid);
insertHistory.run(horizonRca2.lastInsertRowid, 'requested',            h2t0.toISOString(), h2t1.toISOString(), Math.round((h2t1 - h2t0) / 60000), 'Rachel Patel', null);
insertHistory.run(horizonRca2.lastInsertRowid, 'ai_draft_ready',       h2t1.toISOString(), h2t2.toISOString(), Math.round((h2t2 - h2t1) / 60000), 'Rachel Patel', null);
insertHistory.run(horizonRca2.lastInsertRowid, 'drafting',             h2t2.toISOString(), h2t3.toISOString(), Math.round((h2t3 - h2t2) / 60000), 'Jake Wilson', null);
insertHistory.run(horizonRca2.lastInsertRowid, 'service_owner_review', h2t3.toISOString(), h2t4.toISOString(), Math.round((h2t4 - h2t3) / 60000), 'Jake Wilson', null);
insertHistory.run(horizonRca2.lastInsertRowid, 'vp_svp_review',       h2t4.toISOString(), h2t5.toISOString(), Math.round((h2t5 - h2t4) / 60000), 'Rachel Patel', null);
insertHistory.run(horizonRca2.lastInsertRowid, 'tech_writer_review',   h2t5.toISOString(), h2t6.toISOString(), Math.round((h2t6 - h2t5) / 60000), 'Rachel Patel', null);
insertHistory.run(horizonRca2.lastInsertRowid, 'pr_legal_review',      h2t6.toISOString(), h2t7.toISOString(), Math.round((h2t7 - h2t6) / 60000), 'Rachel Patel', null);
insertHistory.run(horizonRca2.lastInsertRowid, 'published',            h2t7.toISOString(), null, null, 'Rachel Patel', null);

console.log('✅  Horizon Systems: 2 additional published incidents added (API gateway Sev1 + Auth failure Sev0)');
