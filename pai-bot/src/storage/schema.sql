-- PAI Bot Database Schema

-- Conversation history
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, created_at);

-- Long-term memories
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  content TEXT NOT NULL,
  importance INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_accessed DATETIME
);

CREATE INDEX IF NOT EXISTS idx_mem_user ON memories(user_id);

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
