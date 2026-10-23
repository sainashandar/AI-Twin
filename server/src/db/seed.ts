import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export function seedDatabase(db: Database.Database) {
  // Check if profile exists already
  const existingProfile = db.prepare('SELECT id FROM profiles LIMIT 1').get();
  if (existingProfile) {
    return; // Already seeded
  }

  const profileId = uuidv4();
  db.prepare(`
    INSERT INTO profiles (id, name, email) 
    VALUES (?, ?, ?)
  `).run(profileId, 'Alex Mercer', 'alex.mercer@continuity.ai');

  // Insert Default Privacy Settings
  db.prepare(`
    INSERT INTO privacy_settings (
      id, tracking_enabled, browser_wide_tracking, session_idle_threshold_minutes, local_only_ai, ai_provider, retention_days
    ) VALUES (?, 1, 1, 25, 0, 'mock', 90)
  `).run(uuidv4());

  // Insert Default Sensitive Domain Exclusions
  const sensitiveDomains = [
    { domain: 'accounts.google.com', reason: 'Authentication and login portal' },
    { domain: 'login.microsoftonline.com', reason: 'Identity provider' },
    { domain: 'github.com/login', reason: 'Credential input' },
    { domain: 'chase.com', reason: 'Financial & banking institution' },
    { domain: 'bankofamerica.com', reason: 'Financial & banking institution' },
    { domain: 'paypal.com', reason: 'Financial payments' },
    { domain: 'stripe.com', reason: 'Billing & payment portal' },
    { domain: '1password.com', reason: 'Password vault manager' },
    { domain: 'vault.bitwarden.com', reason: 'Password vault' },
    { domain: 'healthcare.gov', reason: 'Confidential medical portal' },
  ];

  const insertDomain = db.prepare(`
    INSERT OR IGNORE INTO excluded_domains (id, domain, reason, is_active)
    VALUES (?, ?, ?, 1)
  `);
  for (const d of sensitiveDomains) {
    insertDomain.run(uuidv4(), d.domain, d.reason);
  }

  // Projects
  const projContinuityId = 'proj-continuity-01';
  const projClientProposalId = 'proj-client-fintech-02';
  const projPersonalGrowthId = 'proj-health-03';

  const insertProject = db.prepare(`
    INSERT INTO projects (id, name, description, color, status)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertProject.run(
    projContinuityId,
    'Continuity AI Agent',
    'Personal continuity agent with persistent browser memory, intelligent prioritization, and follow-through workflows.',
    '#10b981',
    'active'
  );

  insertProject.run(
    projClientProposalId,
    'FinTech AI Continuity Proposal',
    'Enterprise proposal and proof-of-concept for Apex Financial workflow continuity automation.',
    '#6366f1',
    'active'
  );

  insertProject.run(
    projPersonalGrowthId,
    'Physical Health & Ergonomics',
    'Optimizing focus intervals, hydration, ergonomic workstation, and running schedule.',
    '#f59e0b',
    'active'
  );

  // Goals
  const goalLaunchMvpId = 'goal-launch-mvp';
  const goalClientSignoffId = 'goal-client-signoff';

  const insertGoal = db.prepare(`
    INSERT INTO goals (id, project_id, title, description, target_date, progress, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertGoal.run(
    goalLaunchMvpId,
    projContinuityId,
    'Ship Usable Local MVP with Approval State Machine',
    'Complete browser activity tracking, memory persistence, prioritization, and human-in-the-loop follow-through.',
    new Date(Date.now() + 5 * 86400000).toISOString(),
    75,
    'in_progress'
  );

  insertGoal.run(
    goalClientSignoffId,
    projClientProposalId,
    'Deliver Proof-of-Concept & Secure Pilot Agreement',
    'Finalize the technical specification and secure signed pilot agreement with Marcus Vance at Apex Financial.',
    new Date(Date.now() + 8 * 86400000).toISOString(),
    40,
    'in_progress'
  );

  // Tasks
  const taskId1 = 'task-api-validation';
  const taskId2 = 'task-failure-tests';
  const taskId3 = 'task-proposal-draft';
  const taskId4 = 'task-invoice-prep';

  const insertTask = db.prepare(`
    INSERT INTO tasks (
      id, project_id, goal_id, title, description, status, priority_score, priority_level, deadline, estimated_minutes, dependencies, blocker_reason, confidence, is_ai_recommended, ai_recommendation_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTask.run(
    taskId1,
    projContinuityId,
    goalLaunchMvpId,
    'Validate AI Provider streaming response & fallback handling',
    'Ensure mock and real AI providers return structured JSON with confidence ratings and fallback gracefully without crash.',
    'in_progress',
    92.5,
    'critical',
    new Date(Date.now() + 4 * 3600000).toISOString(),
    45,
    '[]',
    null,
    0.95,
    1,
    'High priority: Blocks end-to-end follow-up drafting and conversational retrieval verification.'
  );

  insertTask.run(
    taskId2,
    projContinuityId,
    goalLaunchMvpId,
    'Test edge-case failure cases in Approval State Machine',
    'Verify that modifying approved draft invalidates approval and stops automated sending.',
    'pending',
    84.0,
    'high',
    new Date(Date.now() + 18 * 3600000).toISOString(),
    60,
    JSON.stringify([taskId1]),
    'Waiting on API validation completion',
    0.9,
    0,
    null
  );

  insertTask.run(
    taskId3,
    projClientProposalId,
    goalClientSignoffId,
    'Follow up with Marcus at Apex Financial regarding training manual review',
    'Send concise check-in email if the feedback on Section 4 has not been received by 2:00 PM.',
    'pending',
    88.0,
    'critical',
    new Date(Date.now() + 2 * 3600000).toISOString(),
    15,
    '[]',
    null,
    1.0,
    1,
    'Critical commitment: Promised Marcus an update regarding their deployment window.'
  );

  insertTask.run(
    taskId4,
    projClientProposalId,
    goalClientSignoffId,
    'Draft milestone 1 invoice and retainage statement',
    'Prepare billing statement after Marcus approves the initial technical specification.',
    'pending',
    45.0,
    'medium',
    new Date(Date.now() + 48 * 3600000).toISOString(),
    30,
    JSON.stringify([taskId3]),
    'Blocked until client feedback is received',
    0.7,
    0,
    null
  );

  // Activity Session & Records (Simulated realistic recent session)
  const sessionId1 = 'session-yesterday-arch';
  const insertSession = db.prepare(`
    INSERT INTO activity_sessions (
      id, project_id, title, summary, start_time, end_time, status, page_count, decisions, tasks_identified, blockers, next_steps, evidence_references, user_confirmed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSession.run(
    sessionId1,
    projContinuityId,
    'Continuity Engine Architecture & Memory Retrieval Design',
    'Researched local SQLite FTS5 full-text search strategies, analyzed Chrome Extension Manifest V3 service worker lifecycle constraints, and established the 6-type memory taxonomy.',
    new Date(Date.now() - 3 * 3600000).toISOString(),
    new Date(Date.now() - 1 * 3600000).toISOString(),
    'completed',
    4,
    JSON.stringify([
      'Decided to use SQLite FTS5 for zero-dependency local full-text search with BM25 ranking',
      'Architected strict approval state machine with SHA256 content immutability checks'
    ]),
    JSON.stringify([
      'Build Vitest automated suite for approval invalidation',
      'Create live browser activity simulator for instant web dashboard validation'
    ]),
    JSON.stringify([
      'Chrome MV3 service workers terminate after 30s inactivity; must persist state to SQLite backend'
    ]),
    JSON.stringify([
      'Validate AI provider abstraction with mock fallback',
      'Review pending email draft to Marcus Vance'
    ]),
    JSON.stringify([
      'https://developer.chrome.com/docs/extensions/mv3/service_workers/',
      'https://sqlite.org/fts5.html'
    ]),
    1
  );

  // Activity Records
  const insertRecord = db.prepare(`
    INSERT INTO activity_records (
      id, session_id, url, domain, title, content_snippet, visit_time, duration_seconds, is_sensitive, user_approved
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertRecord.run(
    uuidv4(),
    sessionId1,
    'https://developer.chrome.com/docs/extensions/mv3/service_workers/',
    'developer.chrome.com',
    'Chrome Extensions - Service Worker Lifecycle in MV3',
    'Extensions using Manifest V3 run service workers on-demand. To handle persistent tasks, background events should dispatch to local endpoints or wake via alarms.',
    new Date(Date.now() - 2.8 * 3600000).toISOString(),
    420,
    0,
    1
  );

  insertRecord.run(
    uuidv4(),
    sessionId1,
    'https://sqlite.org/fts5.html',
    'sqlite.org',
    'SQLite FTS5 Extension Documentation',
    'FTS5 is an SQLite virtual table module that provides full-text search capability to database applications. Supports porter stemmer and prefix queries.',
    new Date(Date.now() - 2.2 * 3600000).toISOString(),
    680,
    0,
    1
  );

  insertRecord.run(
    uuidv4(),
    sessionId1,
    'https://apexfinancial.demo/proposals/poc-v1',
    'apexfinancial.demo',
    'Apex Financial POC Architecture Review - Training Manual Section 4',
    'Discussed training manual data boundaries, privacy sandboxing, and scheduled follow-up for Tuesday afternoon.',
    new Date(Date.now() - 1.4 * 3600000).toISOString(),
    510,
    0,
    1
  );

  // Memories across all 6 memory types
  const memories = [
    {
      id: uuidv4(),
      memory_type: 'episodic',
      content: 'Yesterday, spent 2.5 hours finalizing the Continuity AI architecture. Validated that SQLite FTS5 enables instant BM25 lexical search without heavy embedding models, keeping memory local.',
      project_id: projContinuityId,
      source_type: 'browser_session',
      source_id: sessionId1,
      source_url: 'https://sqlite.org/fts5.html',
      source_title: 'SQLite FTS5 Documentation',
      confidence: 1.0,
      evidence_notes: 'Confirmed in work session session-yesterday-arch'
    },
    {
      id: uuidv4(),
      memory_type: 'project',
      content: 'Project Continuity AI Core Decision: External actions (like sending emails or triggering webhooks) must NEVER execute autonomously without explicit user approval through the strict state machine.',
      project_id: projContinuityId,
      source_type: 'manual',
      source_id: null,
      source_url: null,
      source_title: 'Architecture Blueprint',
      confidence: 1.0,
      evidence_notes: 'Section 9 product specification principle'
    },
    {
      id: uuidv4(),
      memory_type: 'task',
      content: 'Task: Test edge-case failure cases in Approval State Machine is blocked until API validation passes.',
      project_id: projContinuityId,
      source_type: 'task',
      source_id: taskId2,
      source_url: null,
      source_title: 'Task Dependency Graph',
      confidence: 0.95,
      evidence_notes: 'Linked dependency on task-api-validation'
    },
    {
      id: uuidv4(),
      memory_type: 'goal',
      content: 'Personal Goal: Maintain 30-day MVP launch timeline. Current velocity indicates MVP readiness within 5 days if follow-through verification stays on track.',
      project_id: projContinuityId,
      source_type: 'note',
      source_id: null,
      source_url: null,
      source_title: 'Founder Notebook',
      confidence: 0.9,
      evidence_notes: 'Derived from 30-day launch ambition note'
    },
    {
      id: uuidv4(),
      memory_type: 'commitment',
      content: 'Promised Marcus Vance at Apex Financial that we would follow up today regarding the training manual feedback for Section 4.',
      project_id: projClientProposalId,
      source_type: 'conversation',
      source_id: null,
      source_url: 'https://apexfinancial.demo/proposals/poc-v1',
      source_title: 'Apex Financial POC Meeting',
      confidence: 1.0,
      evidence_notes: 'Extracted from meeting notes with Marcus Vance'
    },
    {
      id: uuidv4(),
      memory_type: 'idea',
      content: 'Idea: Add contextual diffing when the user re-opens a tab after 24 hours, highlighting what changed in the document or codebase since their last visit.',
      project_id: projContinuityId,
      source_type: 'note',
      source_id: null,
      source_url: null,
      source_title: 'Product Brainstorm',
      confidence: 0.85,
      evidence_notes: 'Saved from quick capture'
    }
  ];

  const insertMemory = db.prepare(`
    INSERT INTO memories (
      id, memory_type, content, project_id, source_type, source_id, source_url, source_title, confidence, evidence_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const m of memories) {
    insertMemory.run(
      m.id, m.memory_type, m.content, m.project_id, m.source_type, m.source_id, m.source_url, m.source_title, m.confidence, m.evidence_notes
    );
  }

  // AI Notebook Notes
  const noteId1 = uuidv4();
  const insertNote = db.prepare(`
    INSERT INTO notes (
      id, project_id, title, content, raw_input, tags, is_pinned, ai_suggested_structure, accepted_structure
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertNote.run(
    noteId1,
    projContinuityId,
    '30-Day Launch Blueprint & Safety Checklist',
    'I want to launch my AI continuity product in 30 days. We must guarantee that no emails are sent accidentally, user privacy is completely preserved locally, and users never wonder what they were doing yesterday.',
    'I want to launch my AI product in 30 days. We need complete privacy, no accidental email sends, and seamless resumption of yesterday\'s tabs and thoughts.',
    JSON.stringify(['launch', 'mvp', 'privacy', 'follow-through']),
    1,
    JSON.stringify({
      goal: 'Launch Privacy-First Personal Continuity AI within 30 days',
      milestones: [
        'Milestone 1: Local SQLite & Browser Extension Activity Engine',
        'Milestone 2: Intelligent Prioritization & Grounded Assistant',
        'Milestone 3: Follow-through Approval Gate & Simulated Send'
      ],
      checklists: [
        'Verify zero sensitive credential leaks in network logs',
        'Audit SHA256 immutability check on email drafts',
        'Demonstrate 1-click "Resume where I left off"'
      ]
    }),
    1
  );

  // Commitment & Follow-up in Review state (Showcasing Human-in-the-Loop)
  const commitmentId1 = uuidv4();
  db.prepare(`
    INSERT INTO commitments (
      id, project_id, note_id, recipient_name, recipient_channel, description, due_date, condition_rule, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    commitmentId1,
    projClientProposalId,
    noteId1,
    'Marcus Vance',
    'email',
    'Follow up with Marcus regarding training manual feedback for Section 4 if not received by afternoon',
    new Date(Date.now() + 1.5 * 3600000).toISOString(),
    'Client has not replied to POC specification email',
    'pending'
  );

  const followUpId1 = 'fu-marcus-apex-01';
  const followUpSubject = 'Quick follow-up: Apex Financial POC Training Manual (Section 4)';
  const followUpBody = `Hi Marcus,

Hope your week is going smoothly.

I'm checking in on Section 4 of the POC training manual we discussed during our architecture review yesterday. Our team has finalized the sandboxing boundaries and is ready to initiate the pilot deployment as soon as you give the green light.

Could you let me know if the proposed data retention specifications look good to your team?

Best regards,
Alex Mercer`;

  db.prepare(`
    INSERT INTO follow_ups (
      id, commitment_id, project_id, recipient, channel, subject, proposed_body, current_body, attachments, condition_description, due_at, state, approved_content_hash, execution_attempts, last_check_at, context_check_result, provider_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(
    followUpId1,
    commitmentId1,
    projClientProposalId,
    'marcus.vance@apexfinancial.demo',
    'email',
    followUpSubject,
    followUpBody,
    followUpBody,
    JSON.stringify([]),
    'Condition: No response detected on POC specification thread',
    new Date(Date.now() + 1.5 * 3600000).toISOString(),
    'IN_REVIEW', // Ready for user approval!
    null,
    new Date().toISOString(),
    'Checked authorized mailbox: No incoming email received from marcus.vance@apexfinancial.demo within the last 24 hours. Follow-up is required.',
    'simulated_email'
  );

  // Approval audit log entry
  db.prepare(`
    INSERT INTO approval_audit (
      id, follow_up_id, previous_state, new_state, actor, reason, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    followUpId1,
    'DRAFT_READY',
    'IN_REVIEW',
    'system',
    'Condition verified; draft prepared and waiting for Alex Mercer approval.',
    new Date().toISOString()
  );
}
