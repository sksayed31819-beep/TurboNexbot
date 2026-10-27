-- TurboNex Telegram Moderation Bot - Cloudflare D1 Migration
-- Schema for settings, scheduled channel posts, anti-spam tracking, and audit logs.

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  content TEXT NOT NULL,
  scheduled_epoch INTEGER NOT NULL,
  created_by INTEGER NOT NULL,
  parse_mode TEXT DEFAULT 'Markdown',
  status TEXT DEFAULT 'pending', -- 'pending', 'published', 'failed', 'canceled'
  error_message TEXT,
  created_at INTEGER NOT NULL,
  published_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due ON scheduled_posts(status, scheduled_epoch);

CREATE TABLE IF NOT EXISTS spam_tracker (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  message_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spam_user_time ON spam_tracker(user_id, timestamp);

CREATE TABLE IF NOT EXISTS moderation_logs (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  chat_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  user_handle TEXT,
  action TEXT NOT NULL, -- 'DELETED', 'WARNED', 'MUTED', 'WELCOMED', 'ALLOWED'
  violation_type TEXT,   -- 'url', 'phone', 'spam', NULL
  reason TEXT NOT NULL,
  sanitized_detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_moderation_logs_time ON moderation_logs(timestamp DESC);

-- Seed default settings
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES 
('delete_urls', 'true', strftime('%s', 'now')),
('delete_invites', 'true', strftime('%s', 'now')),
('delete_phone_numbers', 'true', strftime('%s', 'now')),
('anti_spam_enabled', 'true', strftime('%s', 'now')),
('burst_limit', '5', strftime('%s', 'now')),
('burst_window_seconds', '8', strftime('%s', 'now')),
('duplicate_limit', '3', strftime('%s', 'now')),
('duplicate_window_seconds', '30', strftime('%s', 'now')),
('violation_action', 'delete_and_warn', strftime('%s', 'now')),
('welcome_enabled', 'true', strftime('%s', 'now')),
('welcome_template', '👋 Welcome {mention} to {group_name}!\n\n⚡ Enjoy your stay!\n📜 Community Rules: {rules_link}\n🚫 No unauthorized links, phone numbers, or spam permitted from regular members.', strftime('%s', 'now')),
('rules_link', 'https://t.me/turbonex_rules', strftime('%s', 'now'));
