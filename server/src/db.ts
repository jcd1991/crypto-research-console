import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// DATA_DIR lets the Docker image point this at the mounted volume: once
// compiled, dist/db.js sits two levels below /app instead of server/src, so
// the source-relative default below would otherwise resolve outside /app.
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const dataDir = process.env.DATA_DIR ?? join(root, "data");
mkdirSync(dataDir, { recursive: true });

export const db = new Database(join(dataDir, "terminal.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS portfolios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY','SELL')),
  quantity REAL NOT NULL CHECK (quantity > 0),
  price REAL NOT NULL CHECK (price >= 0),
  executed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS research_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('asset','protocol')),
  target_key TEXT NOT NULL,
  provider TEXT NOT NULL,
  venue TEXT NOT NULL,
  instrument TEXT,
  observed_at TEXT NOT NULL,
  source_time TEXT,
  units TEXT,
  native_interval_hours REAL,
  stale INTEGER NOT NULL DEFAULT 0 CHECK (stale IN (0,1)),
  status TEXT NOT NULL CHECK (status IN ('available','unavailable','stale')),
  payload_json TEXT NOT NULL,
  bucket TEXT NOT NULL,
  UNIQUE (target_type, target_key, provider, venue, bucket)
);
CREATE INDEX IF NOT EXISTS idx_research_snapshots_target_time
  ON research_snapshots(target_type, target_key, observed_at DESC);
CREATE TABLE IF NOT EXISTS research_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('asset','protocol')),
  target_key TEXT NOT NULL,
  title TEXT NOT NULL,
  thesis TEXT NOT NULL,
  catalyst TEXT NOT NULL,
  invalidation TEXT NOT NULL,
  horizon TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  snapshot_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invalidated','closed','archived')),
  created_at TEXT NOT NULL,
  closed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_research_notes_created ON research_notes(created_at DESC);
CREATE TABLE IF NOT EXISTS research_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id INTEGER NOT NULL REFERENCES research_notes(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS research_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('asset','protocol')),
  target_key TEXT NOT NULL,
  venue TEXT NOT NULL DEFAULT 'any',
  metric TEXT NOT NULL,
  operator TEXT NOT NULL CHECK (operator IN ('>','>=','<','<=','crosses_above','crosses_below')),
  threshold REAL NOT NULL,
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  last_state INTEGER NOT NULL DEFAULT 0 CHECK (last_state IN (0,1)),
  last_evaluated_at TEXT,
  last_triggered_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_research_alerts_enabled ON research_alerts(enabled, target_type, target_key);
CREATE TABLE IF NOT EXISTS research_alert_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id INTEGER NOT NULL REFERENCES research_alerts(id) ON DELETE CASCADE,
  observed_at TEXT NOT NULL,
  value REAL NOT NULL,
  threshold REAL NOT NULL,
  provider TEXT NOT NULL,
  venue TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_research_alert_events_unread ON research_alert_events(read_at, observed_at DESC);
CREATE TABLE IF NOT EXISTS liquidation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  provider TEXT NOT NULL,
  venue TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('long','short','unknown')),
  price REAL,
  quantity REAL,
  notional_usd REAL,
  observed_at TEXT NOT NULL,
  source_time TEXT,
  payload_json TEXT NOT NULL,
  UNIQUE(provider, venue, symbol, source_time, price, quantity)
);
CREATE INDEX IF NOT EXISTS idx_liquidations_symbol_time ON liquidation_events(symbol, observed_at DESC);
CREATE TABLE IF NOT EXISTS liquidity_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  provider TEXT NOT NULL,
  venue TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  source_time TEXT,
  status TEXT NOT NULL CHECK (status IN ('available','unavailable','stale')),
  payload_json TEXT NOT NULL,
  UNIQUE(provider, venue, symbol, observed_at)
);
CREATE INDEX IF NOT EXISTS idx_liquidity_symbol_time ON liquidity_snapshots(symbol, observed_at DESC);
CREATE TABLE IF NOT EXISTS research_intel_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  target_key TEXT NOT NULL,
  provider TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  source_time TEXT,
  status TEXT NOT NULL CHECK (status IN ('available','unavailable','stale')),
  payload_json TEXT NOT NULL,
  UNIQUE(category, target_key, provider, observed_at)
);
CREATE INDEX IF NOT EXISTS idx_intel_category_time ON research_intel_snapshots(category, target_key, observed_at DESC);
CREATE TABLE IF NOT EXISTS wallet_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chain TEXT NOT NULL,
  address TEXT NOT NULL,
  label TEXT NOT NULL,
  label_type TEXT NOT NULL DEFAULT 'curated',
  source_url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(chain, address)
);
CREATE TABLE IF NOT EXISTS wallet_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id INTEGER NOT NULL REFERENCES wallet_registry(id) ON DELETE CASCADE,
  observed_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available','unavailable','stale')),
  source_url TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  UNIQUE(wallet_id, observed_at)
);
CREATE INDEX IF NOT EXISTS idx_wallet_snapshots_latest ON wallet_snapshots(wallet_id, observed_at DESC);
CREATE TABLE IF NOT EXISTS wallet_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id INTEGER NOT NULL REFERENCES wallet_registry(id) ON DELETE CASCADE,
  observed_at TEXT NOT NULL,
  event_type TEXT NOT NULL,
  asset TEXT NOT NULL,
  previous_value_usd REAL,
  current_value_usd REAL,
  payload_json TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_wallet_events_unread ON wallet_events(read_at, observed_at DESC);
CREATE TABLE IF NOT EXISTS governance_proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol TEXT NOT NULL,
  provider TEXT NOT NULL,
  proposal_key TEXT NOT NULL,
  title TEXT NOT NULL,
  state TEXT,
  start_time TEXT,
  end_time TEXT,
  quorum REAL,
  scores_json TEXT NOT NULL,
  source_url TEXT,
  observed_at TEXT NOT NULL,
  UNIQUE(provider, protocol, proposal_key)
);
CREATE TABLE IF NOT EXISTS unlock_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL,
  protocol TEXT,
  event_date TEXT NOT NULL,
  amount REAL,
  amount_unit TEXT,
  percent_supply REAL,
  vesting_contract TEXT,
  source_url TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(token, event_date, source_url)
);
`);

// Additive migrations for databases created by earlier crypto-terminal builds.
for (const statement of [
  "ALTER TABLE research_alerts ADD COLUMN venue TEXT NOT NULL DEFAULT 'any'",
  "ALTER TABLE research_snapshots ADD COLUMN source_url TEXT",
  "ALTER TABLE research_snapshots ADD COLUMN http_status INTEGER",
  "ALTER TABLE research_snapshots ADD COLUMN fetched_at TEXT",
  "ALTER TABLE research_snapshots ADD COLUMN parser_version TEXT"
  ,"ALTER TABLE wallet_registry ADD COLUMN followed INTEGER NOT NULL DEFAULT 0 CHECK (followed IN (0,1))"
]) {
  try { db.exec(statement); } catch (error) {
    if (!(error instanceof Error) || !/duplicate column name/i.test(error.message)) throw error;
  }
}

const defaultPortfolio = db.prepare("SELECT id FROM portfolios LIMIT 1").get();
if (!defaultPortfolio) {
  db.prepare("INSERT INTO portfolios (name) VALUES (?)").run("Main");
}
