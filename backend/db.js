const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'rca_tracker.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('Sev1', 'Sev0')),
    customer_name TEXT NOT NULL,
    incident_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rca (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id INTEGER NOT NULL REFERENCES incidents(id),
    status TEXT NOT NULL DEFAULT 'requested',
    requested_at TEXT,
    drafting_at TEXT,
    ai_draft_ready_at TEXT,
    vp_review_at TEXT,
    tech_writer_review_at TEXT,
    legal_review_at TEXT,
    published_at TEXT,
    assigned_vp TEXT,
    assigned_csm TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    rca_type TEXT NOT NULL DEFAULT 'single' CHECK(rca_type IN ('single', 'multi')),
    impacted_accounts TEXT,
    impacted_csms TEXT
  );

  CREATE TABLE IF NOT EXISTS stage_history (
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

db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    channels TEXT NOT NULL DEFAULT '["email"]',
    preferences TEXT NOT NULL DEFAULT '["incident_updates"]',
    slack_webhook TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(incident_id, email)
  );
`);

const cols = db.prepare(`PRAGMA table_info(rca)`).all().map(c => c.name);
if (!cols.includes('rca_type'))
  db.exec(`ALTER TABLE rca ADD COLUMN rca_type TEXT NOT NULL DEFAULT 'single'`);
if (!cols.includes('impacted_accounts'))
  db.exec(`ALTER TABLE rca ADD COLUMN impacted_accounts TEXT`);
if (!cols.includes('impacted_csms'))
  db.exec(`ALTER TABLE rca ADD COLUMN impacted_csms TEXT`);
if (!cols.includes('service_owner_review_at'))
  db.exec(`ALTER TABLE rca ADD COLUMN service_owner_review_at TEXT`);
if (!cols.includes('vp_svp_review_at'))
  db.exec(`ALTER TABLE rca ADD COLUMN vp_svp_review_at TEXT`);
if (!cols.includes('pr_legal_review_at'))
  db.exec(`ALTER TABLE rca ADD COLUMN pr_legal_review_at TEXT`);
if (!cols.includes('impacted_services'))
  db.exec(`ALTER TABLE rca ADD COLUMN impacted_services TEXT`);

// ─── One-time migration: rename old stage names to new ones ───────────────────
const oldStageCount = db.prepare(
  `SELECT COUNT(*) AS n FROM stage_history WHERE stage IN ('vp_review','legal_review')`
).get().n;
if (oldStageCount > 0) {
  db.exec(`
    UPDATE stage_history SET stage = 'vp_svp_review'   WHERE stage = 'vp_review';
    UPDATE stage_history SET stage = 'pr_legal_review'  WHERE stage = 'legal_review';
    UPDATE rca SET status = 'vp_svp_review'             WHERE status = 'vp_review';
    UPDATE rca SET status = 'pr_legal_review'            WHERE status = 'legal_review';
    UPDATE rca SET vp_svp_review_at  = vp_review_at     WHERE vp_review_at IS NOT NULL AND vp_svp_review_at IS NULL;
    UPDATE rca SET pr_legal_review_at = legal_review_at  WHERE legal_review_at IS NOT NULL AND pr_legal_review_at IS NULL;
  `);
}

// ─── One-time backfill: redistribute some vp_svp_review active RCAs to service_owner_review ───
const soActiveCount = db.prepare(`SELECT COUNT(*) AS n FROM rca WHERE status = 'service_owner_review'`).get().n;
if (soActiveCount === 0) {
  const vpActive = db.prepare(`SELECT id FROM rca WHERE status = 'vp_svp_review' ORDER BY id`).all();
  // Move roughly half to service_owner_review
  const toMove = vpActive.filter((_, i) => i % 2 === 0);
  const updStatus = db.prepare(`UPDATE rca SET status = 'service_owner_review', service_owner_review_at = vp_svp_review_at WHERE id = ?`);
  const updHist   = db.prepare(`UPDATE stage_history SET stage = 'service_owner_review' WHERE rca_id = ? AND stage = 'vp_svp_review' AND exited_at IS NULL`);
  db.transaction(() => { for (const r of toMove) { updStatus.run(r.id); updHist.run(r.id); } })();
}

// ─── One-time backfill: create service_owner_review history by splitting vp_svp_review ───
const soCount = db.prepare(`SELECT COUNT(*) AS n FROM stage_history WHERE stage = 'service_owner_review'`).get().n;
if (soCount === 0) {
  const vpRows = db.prepare(`
    SELECT sh.id, sh.rca_id, sh.entered_at, sh.exited_at, sh.duration_minutes, sh.actor
    FROM stage_history sh
    WHERE sh.stage = 'vp_svp_review' AND sh.exited_at IS NOT NULL
  `).all();

  const insertSO  = db.prepare(`INSERT INTO stage_history (rca_id, stage, entered_at, exited_at, duration_minutes, actor) VALUES (?, 'service_owner_review', ?, ?, ?, ?)`);
  const updateVP  = db.prepare(`UPDATE stage_history SET entered_at = ?, duration_minutes = ? WHERE id = ?`);
  const updateRca = db.prepare(`UPDATE rca SET service_owner_review_at = ? WHERE id = ? AND service_owner_review_at IS NULL`);

  db.transaction(() => {
    for (const rec of vpRows) {
      const totalMs = new Date(rec.exited_at) - new Date(rec.entered_at);
      const splitMs = Math.round(totalMs * 0.25);
      const splitAt = new Date(new Date(rec.entered_at).getTime() + splitMs).toISOString();
      insertSO.run(rec.rca_id, rec.entered_at, splitAt, Math.round(splitMs / 60000), rec.actor);
      updateVP.run(splitAt, Math.round((totalMs - splitMs) / 60000), rec.id);
      updateRca.run(rec.entered_at, rec.rca_id);
    }
  })();
}

// ─── One-time backfill: populate impacted_services for existing records ────────
const nullCount = db.prepare(`SELECT COUNT(*) AS n FROM rca WHERE impacted_services IS NULL`).get().n;
if (nullCount > 0) {
  // Keyword → services mapping used to infer affected services from incident title
  const RULES = [
    { kw: ['auth', 'sso', 'login', 'oauth', 'session', 'token'],
      svcs: ['Salesforce Identity', 'Salesforce Platform', 'Single Sign-On (SSO)'] },
    { kw: ['payment', 'transaction', 'commerce'],
      svcs: ['Commerce Cloud', 'MuleSoft Anypoint Platform', 'Salesforce Platform'] },
    { kw: ['api', 'webhook', 'integration', 'partner', 'endpoint'],
      svcs: ['External Services', 'MuleSoft Anypoint Platform', 'Platform Events', 'Salesforce Connect'] },
    { kw: ['kafka', 'queue', 'message', 'event'],
      svcs: ['Data Cloud', 'MuleSoft Anypoint Platform', 'Platform Events'] },
    { kw: ['pipeline', 'ingestion', 'replication', 'data'],
      svcs: ['CRM Analytics', 'Data Cloud', 'MuleSoft Anypoint Platform', 'Tableau'] },
    { kw: ['analytics', 'search', 'index', 'report'],
      svcs: ['CRM Analytics', 'Data Cloud', 'Reports & Dashboards', 'Salesforce Platform'] },
    { kw: ['deploy', 'rollout', 'patch', 'configuration'],
      svcs: ['Apex', 'DevOps Center', 'Sales Cloud', 'Salesforce Platform', 'Service Cloud'] },
    { kw: ['batch', 'scheduled', 'job'],
      svcs: ['Apex', 'Flow Builder', 'Salesforce Platform'] },
    { kw: ['container', 'orchestration', 'heroku', 'serverless'],
      svcs: ['Heroku', 'Hyperforce', 'Salesforce Functions'] },
    { kw: ['cdn', 'cache', 'redis', 'memory'],
      svcs: ['Experience Cloud', 'Hyperforce', 'Lightning Platform', 'Salesforce Platform'] },
    { kw: ['ssl', 'tls', 'certificate', 'ddos', 'security', 'encrypt'],
      svcs: ['Hyperforce', 'Salesforce Platform', 'Shield'] },
    { kw: ['network', 'dns', 'partition', 'load balancer', 'region', 'zone'],
      svcs: ['Hyperforce', 'MuleSoft Anypoint Platform', 'Salesforce Platform', 'Slack'] },
    { kw: ['monitor', 'alert'],
      svcs: ['Salesforce Platform', 'Shield'] },
    { kw: ['storage', 'exhaustion', 'disk'],
      svcs: ['Hyperforce', 'Salesforce Platform', 'Shield'] },
    { kw: ['database', 'connection pool', 'failover', 'elasticsearch', 'split-brain'],
      svcs: ['Apex', 'Data Cloud', 'Salesforce Platform'] },
  ];

  function inferServices(title) {
    const t = title.toLowerCase();
    const found = new Set();
    for (const { kw, svcs } of RULES) {
      if (kw.some(k => t.includes(k))) svcs.forEach(s => found.add(s));
    }
    if (found.size === 0) { found.add('Hyperforce'); found.add('Salesforce Platform'); }
    return JSON.stringify([...found].sort());
  }

  const rows = db.prepare(
    `SELECT r.id, i.title FROM rca r JOIN incidents i ON i.id = r.incident_id WHERE r.impacted_services IS NULL`
  ).all();
  const upd = db.prepare(`UPDATE rca SET impacted_services = ? WHERE id = ?`);
  const backfill = db.transaction(() => { for (const r of rows) upd.run(inferServices(r.title), r.id); });
  backfill();
}

// ─── One-time fix: Sev1 RCAs should never be in pr_legal_review ───────────────
const sev1LegalCount = db.prepare(`
  SELECT COUNT(*) AS n FROM rca r
  JOIN incidents i ON i.id = r.incident_id
  WHERE i.severity = 'Sev1' AND r.status = 'pr_legal_review'
`).get().n;
if (sev1LegalCount > 0) {
  const stuck = db.prepare(`
    SELECT r.id FROM rca r
    JOIN incidents i ON i.id = r.incident_id
    WHERE i.severity = 'Sev1' AND r.status = 'pr_legal_review'
  `).all();
  const publish   = db.prepare(`UPDATE rca SET status = 'published', published_at = datetime('now') WHERE id = ?`);
  const closeHist = db.prepare(`UPDATE stage_history SET exited_at = datetime('now'), duration_minutes = 0 WHERE rca_id = ? AND stage = 'pr_legal_review' AND exited_at IS NULL`);
  db.transaction(() => { for (const r of stuck) { closeHist.run(r.id); publish.run(r.id); } })();
}

// ─── One-time fix: remove pr_legal_review history entries for Sev1 RCAs ──────
db.exec(`
  DELETE FROM stage_history
  WHERE stage = 'pr_legal_review'
    AND rca_id IN (
      SELECT r.id FROM rca r
      JOIN incidents i ON i.id = r.incident_id
      WHERE i.severity = 'Sev1'
    )
`);

module.exports = db;
