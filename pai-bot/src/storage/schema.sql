-- PAI Bot Database Schema

-- Conversation history
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  message_id TEXT, -- Discord/Telegram message ID for deduplication
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conv_message_id ON conversations(message_id);

-- Long-term memories
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  importance INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  last_accessed TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mem_user ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_mem_category ON memories(user_id, category);

-- Soft delete archive table
CREATE TABLE IF NOT EXISTS deleted_memories (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  importance INTEGER,
  created_at TEXT,
  deleted_at TEXT NOT NULL
);

-- File records
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  file_id TEXT NOT NULL,
  file_type TEXT,
  local_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);

-- Scheduled tasks
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cron_expression TEXT,
  run_at DATETIME,
  task_type TEXT NOT NULL CHECK (task_type IN ('message', 'prompt')),
  task_data TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  enabled INTEGER DEFAULT 1,
  last_run DATETIME,
  next_run DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schedules_next ON schedules(enabled, next_run);

-- Schedule execution logs
CREATE TABLE IF NOT EXISTS schedule_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  result TEXT,
  error_message TEXT,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schedule_logs_schedule ON schedule_logs(schedule_id, executed_at DESC);

-- Discord bound channels
CREATE TABLE IF NOT EXISTS discord_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL UNIQUE,
  guild_id TEXT,
  bound_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_discord_channels ON discord_channels(channel_id);

-- Sessions (platform info for notifications)
CREATE TABLE IF NOT EXISTS sessions (
  session_id INTEGER PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('telegram', 'discord')),
  platform_user_id TEXT,           -- Original platform user ID (snowflake for Discord)
  chat_id TEXT,                    -- Telegram chat ID for sending messages
  channel_id TEXT,                 -- Discord channel ID for sending messages
  guild_id TEXT,                   -- Discord guild ID (for channel mode)
  session_type TEXT NOT NULL CHECK (session_type IN ('dm', 'channel')),
  is_hq INTEGER DEFAULT 0,         -- 1 if this session is the HQ for system notifications
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_platform ON sessions(platform);
CREATE INDEX IF NOT EXISTS idx_sessions_hq ON sessions(is_hq);

-- Intel Feed: seen items for deduplication
CREATE TABLE IF NOT EXISTS intel_seen_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  item_id TEXT NOT NULL,
  title TEXT,
  url TEXT,
  seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source, item_id)
);

CREATE INDEX IF NOT EXISTS idx_intel_seen_date ON intel_seen_items(seen_at);

-- Intel Feed: digest records
CREATE TABLE IF NOT EXISTS intel_digests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  digest_date DATE NOT NULL UNIQUE,
  item_count INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
