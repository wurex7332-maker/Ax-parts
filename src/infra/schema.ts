/** SQLite 表结构。stock_movements 由触发器从物理层禁止 UPDATE / DELETE。 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS materials (
  sku TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  spec_model TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL,
  location TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  safety_stock INTEGER NOT NULL CHECK (safety_stock >= 0),
  supplier TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ENABLED' CHECK (status IN ('ENABLED','DISABLED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movement_no TEXT NOT NULL UNIQUE,
  sku TEXT NOT NULL REFERENCES materials(sku),
  location TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('IN_PURCHASE','IN_RETURN','OUT_ISSUE','COUNT_GAIN','COUNT_LOSS','ADJUST_LOSS','TRANSFER_OUT','TRANSFER_IN','REVERSAL')),
  quantity_signed INTEGER NOT NULL CHECK (quantity_signed <> 0),
  source TEXT NOT NULL DEFAULT '',
  recipient TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  batch TEXT NOT NULL DEFAULT '',
  operator TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  related_doc_no TEXT NOT NULL DEFAULT '',
  related_movement_no TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_movements_sku ON stock_movements(sku);
CREATE INDEX IF NOT EXISTS idx_movements_sku_location ON stock_movements(sku, location);
CREATE INDEX IF NOT EXISTS idx_movements_occurred ON stock_movements(occurred_at);
CREATE INDEX IF NOT EXISTS idx_movements_operator ON stock_movements(operator);

CREATE TRIGGER IF NOT EXISTS stock_movements_no_update
BEFORE UPDATE ON stock_movements
BEGIN
  SELECT RAISE(ABORT, 'stock_movements is append-only');
END;

CREATE TRIGGER IF NOT EXISTS stock_movements_no_delete
BEFORE DELETE ON stock_movements
BEGIN
  SELECT RAISE(ABORT, 'stock_movements is append-only');
END;

CREATE TABLE IF NOT EXISTS stock_locks (
  sku TEXT NOT NULL REFERENCES materials(sku),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  ref_doc_no TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (sku, ref_doc_no)
);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_no TEXT NOT NULL UNIQUE,
  sku TEXT NOT NULL REFERENCES materials(sku),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  expected_date TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','PURCHASING','ARRIVED','COMPLETED')),
  applicant TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ALERT','MANUAL')),
  reject_reason TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON purchase_requests(status);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  request_no TEXT NOT NULL UNIQUE REFERENCES purchase_requests(request_no),
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL CHECK (status IN ('OPEN','CLOSED')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  closed_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ALERT','STOCKOUT','APPROVED','REJECTED','ARRIVED')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  related_doc_no TEXT NOT NULL DEFAULT '',
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON notifications(recipient, is_read);

CREATE TABLE IF NOT EXISTS idempotency_records (
  key TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('warehouse','supervisor','buyer','operator')),
  status TEXT NOT NULL DEFAULT 'ENABLED' CHECK (status IN ('ENABLED','DISABLED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS dictionaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('CATEGORY','UNIT')),
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (type, value)
);
CREATE INDEX IF NOT EXISTS idx_dictionaries_type ON dictionaries(type, sort_order);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  actor_role TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
`;
