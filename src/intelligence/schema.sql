-- Meta Conversation Intelligence & Reactivation Engine Database Schema
-- Compatible with SQLite (Node.js node:sqlite DatabaseSync) and standard SQL

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT DEFAULT 'Owner', -- Owner, Admin, Staff, Analyst
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS meta_pages (
  id TEXT PRIMARY KEY,
  business_id TEXT,
  page_id TEXT NOT NULL UNIQUE,
  page_name TEXT NOT NULL,
  access_token_encrypted TEXT,
  token_expires_at DATETIME,
  connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active', -- active, expired, error, disconnected
  is_demo INTEGER DEFAULT 0,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  meta_user_id TEXT UNIQUE,
  name TEXT NOT NULL,
  profile_url TEXT,
  first_seen_at DATETIME,
  last_seen_at DATETIME,
  source TEXT DEFAULT 'Messenger', -- Messenger, Facebook, Ad response, Instagram, Unknown
  phone TEXT,
  city TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  meta_conversation_id TEXT UNIQUE,
  page_id TEXT,
  contact_id TEXT NOT NULL,
  channel TEXT DEFAULT 'messenger', -- messenger, instagram
  source TEXT DEFAULT 'Messenger', -- Messenger, Facebook, Ad response, Instagram
  ad_id TEXT,
  ad_name TEXT,
  first_message_at DATETIME,
  last_message_at DATETIME,
  message_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open', -- open, closed, needs_followup, converted
  lead_stage TEXT DEFAULT 'جديد', -- مسجل, مؤهل, تم التحويل, مفقود, غير مؤهل, جديد, استفسار, مهتم, سأل عن السعر, طلب موعد, لم يحجز, موعد مؤكد, عميل, عميل سابق
  intent TEXT DEFAULT 'OTHER', -- PRICE_INQUIRY, APPOINTMENT_REQUEST, SERVICE_INQUIRY, LOCATION_INQUIRY, HOURS_INQUIRY, MEDICAL_PROBLEM, HIGH_INTENT, LOW_INTENT, FOLLOW_UP_NEEDED, EXISTING_CUSTOMER, COMPLAINT, SPAM, OTHER
  sentiment TEXT DEFAULT 'neutral', -- positive, neutral, negative
  conversion_status TEXT DEFAULT 'pending', -- pending, booked, converted, lost, disqualified
  opportunity_score INTEGER DEFAULT 0, -- 0-100
  appointment_intent_score INTEGER DEFAULT 0, -- 0-100
  purchase_intent_score INTEGER DEFAULT 0, -- 0-100
  recency_bracket TEXT, -- 0-30 days, 31-90 days, 91-180 days, 181-365 days, 1-2 years, 2+ years
  is_demo INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (page_id) REFERENCES meta_pages(id) ON DELETE SET NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  meta_message_id TEXT UNIQUE,
  sender_type TEXT NOT NULL, -- user, page
  timestamp DATETIME NOT NULL,
  text TEXT,
  attachments_metadata TEXT,
  is_from_page INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS labels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#1877F2',
  description TEXT,
  is_system INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS conversation_labels (
  conversation_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  source TEXT DEFAULT 'auto', -- auto, manual
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, label_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lead_events (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- stage_change, score_update, note_added, label_added, message_sent
  old_value TEXT,
  new_value TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS followups (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  type TEXT DEFAULT 'reactivation', -- reactivation, appointment_reminder, satisfaction_check
  status TEXT DEFAULT 'pending_approval', -- pending_approval, approved, sent, skipped, blocked_policy
  scheduled_at DATETIME,
  completed_at DATETIME,
  proposed_message TEXT,
  approved_by TEXT,
  policy_check_status TEXT, -- ALLOWED_24H, BLOCKED_POLICY, TAG_REQUIRED
  policy_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analysis_results (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL UNIQUE,
  intent TEXT NOT NULL,
  lead_score INTEGER DEFAULT 0,
  purchase_intent INTEGER DEFAULT 0,
  appointment_intent INTEGER DEFAULT 0,
  price_intent INTEGER DEFAULT 0,
  service_interest INTEGER DEFAULT 0,
  summary TEXT,
  recommended_action TEXT,
  confidence TEXT DEFAULT 'عالية',
  purchase_reasons TEXT, -- JSON array of reasons
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analysis_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  condition_type TEXT DEFAULT 'keyword_contains',
  keyword TEXT NOT NULL,
  target_intent TEXT,
  target_label TEXT,
  score_impact INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  audience_filter TEXT, -- JSON query criteria
  message_template TEXT,
  status TEXT DEFAULT 'draft', -- draft, active, completed, paused
  target_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_name TEXT DEFAULT 'المسؤول',
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indices for rapid querying and filters
CREATE INDEX IF NOT EXISTS idx_conv_lead_stage ON conversations(lead_stage);
CREATE INDEX IF NOT EXISTS idx_conv_intent ON conversations(intent);
CREATE INDEX IF NOT EXISTS idx_conv_opportunity_score ON conversations(opportunity_score);
CREATE INDEX IF NOT EXISTS idx_conv_last_message ON conversations(last_message_at);
CREATE INDEX IF NOT EXISTS idx_conv_source ON conversations(source);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
