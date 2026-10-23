export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  status: 'active' | 'completed' | 'archived' | 'paused';
  active_tasks_count?: number;
  completed_tasks_count?: number;
  goals_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  project_id: string | null;
  title: string;
  description: string;
  target_date: string;
  progress: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string | null;
  project_name?: string;
  project_color?: string;
  goal_id: string | null;
  goal_title?: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority_score: number;
  priority_level: 'critical' | 'high' | 'medium' | 'low';
  deadline: string | null;
  estimated_minutes: number;
  dependencies: string[];
  blocker_reason?: string | null;
  confidence: number;
  is_ai_recommended: boolean;
  ai_recommendation_reason?: string | null;
  created_at: string;
}

export interface ActivityRecord {
  id: string;
  session_id: string;
  url: string;
  domain: string;
  title: string;
  content_snippet?: string;
  visit_time: string;
  duration_seconds: number;
  is_sensitive: boolean;
}

export interface ActivitySession {
  id: string;
  project_id: string | null;
  project_name?: string;
  project_color?: string;
  title: string;
  summary: string;
  start_time: string;
  end_time: string;
  status: 'active' | 'idle' | 'completed';
  page_count: number;
  decisions: string[];
  tasks_identified: string[];
  blockers: string[];
  next_steps: string[];
  evidence_references: string[];
  records?: ActivityRecord[];
  user_confirmed: boolean;
}

export interface Memory {
  id: string;
  memory_type: 'episodic' | 'project' | 'task' | 'goal' | 'commitment' | 'idea';
  content: string;
  project_id: string | null;
  project_name?: string;
  project_color?: string;
  source_type: 'browser_session' | 'note' | 'task' | 'conversation' | 'manual';
  source_id?: string;
  source_url?: string;
  source_title?: string;
  confidence: number;
  evidence_notes?: string;
  created_at: string;
}

export interface NoteStructure {
  goal?: string;
  milestones?: string[];
  tasks?: Array<{
    title: string;
    priority?: 'critical' | 'high' | 'medium' | 'low';
    estimated_minutes?: number;
  }>;
  checklists?: string[];
  tags?: string[];
}

export interface Note {
  id: string;
  project_id: string | null;
  project_name?: string;
  project_color?: string;
  title: string;
  content: string;
  raw_input: string;
  tags: string[];
  is_pinned: boolean;
  position_x?: number;
  position_y?: number;
  color?: 'amber' | 'emerald' | 'indigo' | 'rose' | 'cyan' | 'slate' | string;
  ai_suggested_structure?: NoteStructure | null;
  accepted_structure: boolean;
  created_at: string;
  updated_at: string;
}

export type FollowUpState = 
  | 'SCHEDULED' 
  | 'DUE' 
  | 'CONTEXT_CHECK' 
  | 'DRAFT_READY' 
  | 'IN_REVIEW' 
  | 'APPROVED' 
  | 'SENDING' 
  | 'SENT' 
  | 'NEEDS_INPUT' 
  | 'CANCELLED' 
  | 'FAILED' 
  | 'AWAITING_REPLY' 
  | 'COMPLETED';

export interface FollowUp {
  id: string;
  commitment_id: string | null;
  commitment_desc?: string;
  project_id: string | null;
  project_name?: string;
  project_color?: string;
  recipient: string;
  channel: 'email' | 'slack' | 'message';
  subject: string;
  proposed_body: string;
  current_body: string;
  attachments: string[];
  condition_description: string | null;
  due_at: string;
  state: FollowUpState;
  approved_content_hash?: string | null;
  execution_attempts: number;
  last_check_at?: string;
  context_check_result?: string;
  send_time?: string;
  failure_reason?: string;
  provider_type: string;
  provider_response_id?: string;
  created_at: string;
}

export interface PrivacySettings {
  id: string;
  tracking_enabled: boolean;
  browser_wide_tracking: boolean;
  session_idle_threshold_minutes: number;
  local_only_ai: boolean;
  ai_provider: string;
  ai_api_key?: string;
  retention_days: number;
}

export interface ExcludedDomain {
  id: string;
  domain: string;
  reason: string;
  is_active: boolean;
}
