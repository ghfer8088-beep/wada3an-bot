-- ==============================================================
-- Facebook Page Growth & Content Intelligence Platform Schema
-- Database Engine: SQLite (node:sqlite)
-- ==============================================================

-- 1. Pages Management
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT,
  category TEXT,
  followers_count INTEGER DEFAULT 0,
  fans_count INTEGER DEFAULT 0,
  verification_status TEXT DEFAULT 'unverified',
  access_token_status TEXT DEFAULT 'valid',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Posts Table (with complete analytical metadata)
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  permalink_url TEXT,
  post_type TEXT DEFAULT 'status', -- status, photo, video, reel, story
  message TEXT,
  hook TEXT,
  topic TEXT,
  category TEXT,
  has_image INTEGER DEFAULT 0,
  has_video INTEGER DEFAULT 0,
  video_duration REAL DEFAULT 0,
  published_at DATETIME,
  reach INTEGER DEFAULT 0,
  follower_reach INTEGER DEFAULT 0,
  non_follower_reach INTEGER DEFAULT 0,
  reactions_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  video_views INTEGER DEFAULT 0,
  watch_time_seconds REAL DEFAULT 0,
  page_visits INTEGER DEFAULT 0,
  new_followers INTEGER DEFAULT 0,
  engagement_rate REAL DEFAULT 0,
  share_rate REAL DEFAULT 0,
  comment_rate REAL DEFAULT 0,
  follower_conversion REAL DEFAULT 0,
  non_follower_conversion REAL DEFAULT 0,
  expansion_status TEXT DEFAULT 'INITIAL TEST', -- INITIAL TEST, WAITING, GROWING, EXPANDING, COOLING, SATURATED
  performance_tier TEXT DEFAULT 'NORMAL',      -- WINNER, NORMAL, WEAK
  raw_meta_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (page_id) REFERENCES pages(id)
);

-- 3. Post Snapshots (Distribution Velocity Tracker)
CREATE TABLE IF NOT EXISTS post_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT NOT NULL,
  snapshot_window TEXT NOT NULL, -- 15m, 30m, 60m, 3h, 6h, 12h, 24h, 48h
  minutes_since_publish INTEGER NOT NULL,
  reach INTEGER DEFAULT 0,
  follower_reach INTEGER DEFAULT 0,
  non_follower_reach INTEGER DEFAULT 0,
  reactions INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  video_views INTEGER DEFAULT 0,
  velocity_reach_per_hour REAL DEFAULT 0,
  velocity_engagement_per_hour REAL DEFAULT 0,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

-- 4. Content Ideas (Ideation & Scoring)
CREATE TABLE IF NOT EXISTS content_ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  angle TEXT,
  target_audience TEXT,
  core_problem TEXT,
  curiosity_score REAL DEFAULT 0,
  discussion_score REAL DEFAULT 0,
  share_score REAL DEFAULT 0,
  save_score REAL DEFAULT 0,
  follower_conversion_score REAL DEFAULT 0,
  non_follower_score REAL DEFAULT 0,
  historical_similarity_note TEXT,
  status TEXT DEFAULT 'IDEA', -- IDEA, ANALYSIS, APPROVED, REJECTED, PUBLISHED
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Experiment Lab (Scientific Testing)
CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY, -- e.g. EXP-001
  title TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  variable_isolated TEXT NOT NULL, -- Hook, Format, Length, Time, CTA
  control_description TEXT NOT NULL,
  variant_description TEXT NOT NULL,
  sample_size_target INTEGER DEFAULT 10,
  status TEXT DEFAULT 'PLANNED', -- PLANNED, ACTIVE, COMPLETED, CANCELLED
  start_date DATE,
  end_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Experiment Results
CREATE TABLE IF NOT EXISTS experiment_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id TEXT NOT NULL,
  control_metric_value REAL NOT NULL,
  variant_metric_value REAL NOT NULL,
  metric_name TEXT NOT NULL, -- e.g. Share Rate, Non-Follower Reach
  difference_percentage REAL NOT NULL,
  confidence_level REAL DEFAULT 0, -- e.g. 95.0
  conclusion TEXT,
  next_experiment_recommendation TEXT,
  finalized_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id)
);

-- 7. Audience Segments
CREATE TABLE IF NOT EXISTS audience_segments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- Active, Engaged, Sharers, Commenters, Video Viewers, Dormant, Returning, New Visitors
  description TEXT,
  estimated_size INTEGER DEFAULT 0,
  top_interests TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Topics Repository
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  category TEXT,
  posts_count INTEGER DEFAULT 0,
  avg_reach REAL DEFAULT 0,
  avg_shares REAL DEFAULT 0,
  avg_non_follower_reach REAL DEFAULT 0,
  fatigue_level TEXT DEFAULT 'HEALTHY', -- HEALTHY, MODERATE, FATIGUED
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Hooks Catalog
CREATE TABLE IF NOT EXISTS hooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hook_text TEXT NOT NULL,
  hook_type TEXT NOT NULL, -- Question, Counter-Intuitive, Story, Alarm, Challenge
  times_used INTEGER DEFAULT 0,
  avg_engagement_rate REAL DEFAULT 0,
  avg_retention_rate REAL DEFAULT 0,
  confidence_score REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Content Formats
CREATE TABLE IF NOT EXISTS content_formats (
  id TEXT PRIMARY KEY, -- standard_post, reel, story, carousel, short_video, question, educational, follow_up
  display_name TEXT NOT NULL,
  avg_reach REAL DEFAULT 0,
  avg_shares REAL DEFAULT 0,
  avg_non_follower_reach REAL DEFAULT 0,
  recommended_posting_window TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Growth Events
CREATE TABLE IF NOT EXISTS growth_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL, -- SPIKE, VIRAL_EXPANSION, FOLLOWER_SURGE, DROP, FATIGUE_WARNING
  title TEXT NOT NULL,
  description TEXT,
  related_post_id TEXT,
  metric_change TEXT,
  occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (related_post_id) REFERENCES posts(id)
);

-- 12. Page Algorithm DNA (Continuous Learning Engine)
CREATE TABLE IF NOT EXISTS page_algorithm_dna (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id TEXT NOT NULL,
  dna_key TEXT NOT NULL, -- best_posting_hours, best_post_types, best_hooks, best_topics, follower_magnets, non_follower_magnets
  dna_value TEXT NOT NULL, -- JSON or formatted rule
  evidence_type TEXT NOT NULL, -- FACT, CORRELATION, HYPOTHESIS, RECOMMENDATION
  confidence_percentage REAL DEFAULT 0,
  sample_size INTEGER DEFAULT 0,
  last_evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (page_id) REFERENCES pages(id)
);

-- 13. Trends Radar
CREATE TABLE IF NOT EXISTS trends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  source TEXT DEFAULT 'Page Comments / Audience Analysis',
  urgency_score REAL DEFAULT 0,
  content_gap_note TEXT,
  suggested_angle TEXT,
  is_actioned INTEGER DEFAULT 0,
  detected_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. Comments Repository & Miner
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  sender_name TEXT,
  sender_id TEXT,
  comment_text TEXT NOT NULL,
  sentiment TEXT,
  is_question INTEGER DEFAULT 0,
  extracted_problem TEXT,
  is_potential_post_idea INTEGER DEFAULT 0,
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

-- 15. Content Repurposing (Resurrection & Multi-format)
CREATE TABLE IF NOT EXISTS content_repurposing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_post_id TEXT NOT NULL,
  repurposed_type TEXT NOT NULL, -- Reel, Carousel, Story, Updated Post
  new_hook TEXT NOT NULL,
  new_content TEXT NOT NULL,
  resurrection_category TEXT DEFAULT 'Evergreen', -- Evergreen, Needs Update, Expired, High Potential
  approval_status TEXT DEFAULT 'PENDING',        -- PENDING, APPROVED, REJECTED, PUBLISHED
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (original_post_id) REFERENCES posts(id)
);

-- 16. Notifications (Compliant Human Amplification Panel & System Alerts)
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_name TEXT NOT NULL,
  post_id TEXT,
  notification_type TEXT NOT NULL, -- NEW_POST_ALERT, TASK_NOTIFICATION, EXPANSION_ALERT
  message TEXT NOT NULL,
  post_url TEXT,
  is_sent INTEGER DEFAULT 0,
  is_viewed INTEGER DEFAULT 0,
  is_clicked INTEGER DEFAULT 0,
  is_participated INTEGER DEFAULT 0, -- Voluntary human participation tracking
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

-- 17. Users / Team Members
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'analyst', -- admin, editor, analyst, collaborator
  email TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 18. Settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 19. Audit Logs (Complete Operational Traceability)
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,       -- Post fetched, Snapshot saved, Experiment started, etc.
  category TEXT NOT NULL,     -- META_API, ENGINE, EXPERIMENT, WORKFLOW, SECURITY
  details TEXT,
  status TEXT DEFAULT 'SUCCESS', -- SUCCESS, WARNING, ERROR
  error_message TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for Optimal Performance
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at);
CREATE INDEX IF NOT EXISTS idx_posts_expansion_status ON posts(expansion_status);
CREATE INDEX IF NOT EXISTS idx_post_snapshots_post_id ON post_snapshots(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
