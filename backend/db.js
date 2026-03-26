const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'rca_tracker.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('Sev1', 'Sev2')),
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
    created_at TEXT DEFAULT (datetime('now'))
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

module.exports = db;
