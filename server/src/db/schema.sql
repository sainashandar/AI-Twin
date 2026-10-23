-- Continuity AI Database Schema (SQLite)

PRAGMA foreign_keys = ON;

-- User Profile
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#10b981',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'paused')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Goals & Milestones
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATETIME,
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('not_started', 'in_progress', 'completed', 'blocked')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  priority_score REAL DEFAULT 50.0,
  priority_level TEXT DEFAULT 'medium' CHECK (priority_level IN ('critical', 'high', 'medium', 'low')),
  deadline DATETIME,
  estimated_minutes INTEGER DEFAULT 30,
  dependencies TEXT DEFAULT '[]', -- JSON array of task IDs
  blocker_reason TEXT,
  confidence REAL DEFAULT 1.0, -- Confidence that task remains unfinished
  is_ai_recommended BOOLEAN DEFAULT 0,
  ai_recommendation_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Activity Sessions (Grouped work sessions from browser or manual activity)
CREATE TABLE IF NOT EXISTS activity_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'idle', 'completed')),
  page_count INTEGER DEFAULT 0,
  decisions TEXT DEFAULT '[]', -- JSON array of strings
  tasks_identified TEXT DEFAULT '[]', -- JSON array of task strings
  blockers TEXT DEFAULT '[]', -- JSON array of strings
  next_steps TEXT DEFAULT '[]', -- JSON array of strings
  evidence_references TEXT DEFAULT '[]', -- JSON array of URLs / page titles
  user_confirmed BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Activity Records (Specific page events captured)
CREATE TABLE IF NOT EXISTS activity_records (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES activity_sessions(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT NOT NULL,
  content_snippet TEXT,
  visit_time DATETIME NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  is_sensitive BOOLEAN DEFAULT 0,
  user_approved BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Persistent Personal Memory Store
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('episodic', 'project', 'task', 'goal', 'commitment', 'idea')),
  content TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('browser_session', 'note', 'task', 'conversation', 'manual')),
  source_id TEXT,
  source_url TEXT,
  source_title TEXT,
  confidence REAL DEFAULT 1.0,
  evidence_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI Notebook Notes
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  raw_input TEXT,
  tags TEXT DEFAULT '[]', -- JSON array
  is_pinned BOOLEAN DEFAULT 0,
  position_x REAL DEFAULT 100,
  position_y REAL DEFAULT 100,
  color TEXT DEFAULT 'amber',
  ai_suggested_structure TEXT, -- JSON structure (proposed tasks, goals, checklists)
  accepted_structure BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Commitments Extracted from Work & Conversation
CREATE TABLE IF NOT EXISTS commitments (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
  recipient_name TEXT NOT NULL,
  recipient_channel TEXT DEFAULT 'email',
  description TEXT NOT NULL,
  due_date DATETIME,
  condition_rule TEXT, -- e.g. "if client has not replied to training manual"
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Follow-up Workflows & Approval State Machine
CREATE TABLE IF NOT EXISTS follow_ups (
  id TEXT PRIMARY KEY,
  commitment_id TEXT REFERENCES commitments(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  channel TEXT DEFAULT 'email' CHECK (channel IN ('email', 'slack', 'message')),
  subject TEXT NOT NULL,
  proposed_body TEXT NOT NULL,
  current_body TEXT NOT NULL,
  attachments TEXT DEFAULT '[]', -- JSON array
  condition_description TEXT,
  due_at DATETIME NOT NULL,
  state TEXT DEFAULT 'SCHEDULED' CHECK (state IN (
    'SCHEDULED', 'DUE', 'CONTEXT_CHECK', 'DRAFT_READY', 
    'IN_REVIEW', 'APPROVED', 'SENDING', 'SENT', 
    'NEEDS_INPUT', 'CANCELLED', 'FAILED', 'AWAITING_REPLY', 'COMPLETED'
  )),
  approved_content_hash TEXT,
  execution_attempts INTEGER DEFAULT 0,
  last_check_at DATETIME,
  context_check_result TEXT,
  send_time DATETIME,
  failure_reason TEXT,
  provider_type TEXT DEFAULT 'simulated_email',
  provider_response_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Approval Audit Log (Immutable record of approval changes)
CREATE TABLE IF NOT EXISTS approval_audit (
  id TEXT PRIMARY KEY,
  follow_up_id TEXT NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  previous_state TEXT NOT NULL,
  new_state TEXT NOT NULL,
  actor TEXT NOT NULL CHECK (actor IN ('user', 'system', 'ai')),
  reason TEXT,
  content_hash TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Execution Records (Sent items log with simulated/real confirmation)
CREATE TABLE IF NOT EXISTS execution_records (
  id TEXT PRIMARY KEY,
  follow_up_id TEXT REFERENCES follow_ups(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  recipient TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'simulated_success')),
  provider_message_id TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Privacy Settings
CREATE TABLE IF NOT EXISTS privacy_settings (
  id TEXT PRIMARY KEY,
  tracking_enabled BOOLEAN DEFAULT 1,
  browser_wide_tracking BOOLEAN DEFAULT 0,
  session_idle_threshold_minutes INTEGER DEFAULT 25,
  local_only_ai BOOLEAN DEFAULT 0,
  ai_provider TEXT DEFAULT 'mock', -- 'mock', 'openai', 'anthropic', 'ollama'
  ai_api_key TEXT,
  ai_model TEXT DEFAULT 'default',
  retention_days INTEGER DEFAULT 90,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Excluded Domains
CREATE TABLE IF NOT EXISTS excluded_domains (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  reason TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Full-Text Search Virtual Tables
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  id UNINDEXED,
  content,
  memory_type,
  tokenize='porter unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  id UNINDEXED,
  title,
  content,
  tokenize='porter unicode61'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_activity_sessions_status ON activity_sessions(status);
CREATE INDEX IF NOT EXISTS idx_activity_records_session ON activity_records(session_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id);
CREATE INDEX IF NOT EXISTS idx_followups_state ON follow_ups(state);
CREATE INDEX IF NOT EXISTS idx_followups_due ON follow_ups(due_at);
