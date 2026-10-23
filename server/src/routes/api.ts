import { Router } from 'express';
import { getDb } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { ActivityService } from '../services/activityService.js';
import { MemoryService } from '../services/memoryService.js';
import { PrioritizerService } from '../services/prioritizer.js';
import { FollowThroughService } from '../services/followThroughService.js';
import { NotebookService } from '../services/notebookService.js';
import { BriefingService } from '../services/briefingService.js';
import { EmailService } from '../services/emailService.js';
import { broadcastEvent } from '../sse.js';

export const apiRouter = Router();

// ==========================================
// 1. BRIEFING & RESUMPTION
// ==========================================
apiRouter.get('/briefing', async (req, res) => {
  try {
    const data = await BriefingService.getDailyBriefing();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/briefing/resume', (req, res) => {
  try {
    const data = BriefingService.getResumeContext();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. BROWSER ACTIVITY & SESSIONS
// ==========================================
apiRouter.post('/activity/record', (req, res) => {
  try {
    const { url, title, content, durationSeconds, projectId } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const result = ActivityService.recordPageActivity({
      url,
      title: title || 'Untitled Page',
      content,
      durationSeconds,
      projectId
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/activity/check-domain', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  const result = ActivityService.isDomainExcluded(url);
  res.json(result);
});

apiRouter.get('/activity/sessions', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  res.json(ActivityService.getSessions(limit));
});

apiRouter.get('/activity/sessions/:id', (req, res) => {
  const session = ActivityService.getSessionDetails(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

apiRouter.post('/activity/sessions/:id/summarize', async (req, res) => {
  try {
    const result = await ActivityService.summarizeSession(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/activity/sessions/:id', (req, res) => {
  res.json(ActivityService.deleteSession(req.params.id));
});

// ==========================================
// 3. PERSISTENT MEMORY & RAG ASSISTANT
// ==========================================
apiRouter.get('/memory', (req, res) => {
  const { type, projectId, limit } = req.query;
  const memories = MemoryService.getAllMemories({
    type: type as string,
    projectId: projectId as string,
    limit: limit ? parseInt(limit as string) : 50
  });
  res.json(memories);
});

apiRouter.get('/memory/search', (req, res) => {
  const q = req.query.q as string || '';
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  res.json(MemoryService.searchMemories(q, limit));
});

apiRouter.post('/memory', (req, res) => {
  try {
    const memory = MemoryService.addMemory(req.body);
    res.status(201).json(memory);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/memory/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Question is required' });
  try {
    const response = await MemoryService.answerQuestion(question);
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/memory/:id', (req, res) => {
  res.json(MemoryService.deleteMemory(req.params.id));
});

// ==========================================
// 4. PROJECTS & GOALS
// ==========================================
apiRouter.get('/projects', (req, res) => {
  const db = getDb();
  const projects = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status != 'completed') as active_tasks_count,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'completed') as completed_tasks_count,
      (SELECT COUNT(*) FROM goals WHERE project_id = p.id) as goals_count
    FROM projects p
    ORDER BY p.updated_at DESC
  `).all();
  res.json(projects);
});

apiRouter.post('/projects', (req, res) => {
  const db = getDb();
  const { name, description, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const id = uuidv4();
  db.prepare(`
    INSERT INTO projects (id, name, description, color, status)
    VALUES (?, ?, ?, ?, 'active')
  `).run(id, name, description || '', color || '#10b981');
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  broadcastEvent('PROJECT_CREATED', project);
  res.status(201).json(project);
});

apiRouter.get('/projects/:id/details', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const goals = db.prepare('SELECT * FROM goals WHERE project_id = ? ORDER BY created_at DESC').all(req.params.id);
  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY priority_score DESC').all(req.params.id);
  const memories = db.prepare('SELECT * FROM memories WHERE project_id = ? ORDER BY created_at DESC LIMIT 10').all(req.params.id);
  const sessions = db.prepare('SELECT * FROM activity_sessions WHERE project_id = ? ORDER BY start_time DESC LIMIT 5').all(req.params.id);
  const followUps = db.prepare('SELECT * FROM follow_ups WHERE project_id = ? ORDER BY due_at ASC').all(req.params.id);

  res.json({
    project,
    goals,
    tasks: tasks.map((t: any) => ({ ...t, dependencies: JSON.parse(t.dependencies || '[]') })),
    memories,
    sessions,
    followUps
  });
});

// ==========================================
// 5. TASKS & PRIORITIZATION
// ==========================================
apiRouter.get('/tasks', (req, res) => {
  const db = getDb();
  const { status, projectId } = req.query;
  let sql = `
    SELECT t.*, p.name as project_name, p.color as project_color, g.title as goal_title 
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN goals g ON t.goal_id = g.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (status) {
    sql += ' AND t.status = ?';
    params.push(status);
  }
  if (projectId) {
    sql += ' AND t.project_id = ?';
    params.push(projectId);
  }
  sql += ' ORDER BY t.priority_score DESC, t.deadline ASC';
  const tasks = db.prepare(sql).all(...params) as any[];
  res.json(tasks.map(t => ({ ...t, dependencies: JSON.parse(t.dependencies || '[]') })));
});

apiRouter.post('/tasks', (req, res) => {
  const db = getDb();
  const { title, description, projectId, goalId, priorityLevel, deadline, estimatedMinutes, dependencies } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO tasks (
      id, project_id, goal_id, title, description, priority_level, deadline, estimated_minutes, dependencies, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    id,
    projectId || null,
    goalId || null,
    title,
    description || '',
    priorityLevel || 'medium',
    deadline || null,
    estimatedMinutes || 30,
    JSON.stringify(dependencies || [])
  );

  PrioritizerService.evaluateAllTasks(90);
  const created = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  broadcastEvent('TASK_CREATED', created);
  res.status(201).json({ ...created, dependencies: JSON.parse(created.dependencies || '[]') });
});

apiRouter.put('/tasks/:id', (req, res) => {
  const db = getDb();
  const current = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any;
  if (!current) return res.status(404).json({ error: 'Task not found' });

  const { status, title, description, priorityLevel, deadline, estimatedMinutes, dependencies, confidence } = req.body;
  db.prepare(`
    UPDATE tasks 
    SET status = ?, title = ?, description = ?, priority_level = ?, deadline = ?, estimated_minutes = ?, dependencies = ?, confidence = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    status ?? current.status,
    title ?? current.title,
    description ?? current.description,
    priorityLevel ?? current.priority_level,
    deadline !== undefined ? deadline : current.deadline,
    estimatedMinutes ?? current.estimated_minutes,
    dependencies ? JSON.stringify(dependencies) : current.dependencies,
    confidence ?? current.confidence,
    req.params.id
  );

  PrioritizerService.evaluateAllTasks(90);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any;
  broadcastEvent('TASK_UPDATED', updated);
  res.json({ ...updated, dependencies: JSON.parse(updated.dependencies || '[]') });
});

apiRouter.post('/tasks/prioritize', (req, res) => {
  const availableMinutes = req.body.availableMinutes ? parseInt(req.body.availableMinutes) : 90;
  PrioritizerService.evaluateAllTasks(availableMinutes);
  res.json({ success: true, evaluatedWithMinutes: availableMinutes });
});

apiRouter.get('/tasks/recommendation', async (req, res) => {
  const availableMinutes = req.query.availableMinutes ? parseInt(req.query.availableMinutes as string) : 90;
  try {
    const rec = await PrioritizerService.getRecommendedNextAction(availableMinutes);
    res.json(rec);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. AI NOTEBOOK
// ==========================================
apiRouter.get('/notes', (req, res) => {
  const projectId = req.query.projectId as string | undefined;
  res.json(NotebookService.getAllNotes(projectId));
});

apiRouter.post('/notes', async (req, res) => {
  try {
    const note = await NotebookService.createNote(req.body);
    res.status(201).json(note);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/notes/:id', (req, res) => {
  try {
    const note = NotebookService.updateNote(req.params.id, req.body);
    res.json(note);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/notes/:id/accept-structure', (req, res) => {
  try {
    const result = NotebookService.acceptStructure(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/notes/:id/generate-structure', async (req, res) => {
  try {
    const note = NotebookService.getNoteById(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    const structure = await NotebookService.generateStructuralSuggestions(note.id, note.content, note.project_id);
    res.json({ success: true, suggestedStructure: structure });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/notes/:id', (req, res) => {
  res.json(NotebookService.deleteNote(req.params.id));
});

// ==========================================
// 7. FOLLOW-THROUGH & APPROVALS
// ==========================================
apiRouter.get('/follow-ups', (req, res) => {
  const state = req.query.state as string | undefined;
  res.json(FollowThroughService.getAllFollowUps(state));
});

apiRouter.post('/follow-ups', (req, res) => {
  try {
    const item = FollowThroughService.createFollowUp(req.body);
    res.status(201).json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/follow-ups/:id', (req, res) => {
  const item = FollowThroughService.getFollowUpById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Follow-up not found' });
  res.json(item);
});

apiRouter.put('/follow-ups/:id/draft', (req, res) => {
  try {
    const item = FollowThroughService.updateDraft(req.params.id, req.body);
    res.json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/follow-ups/:id/approve', (req, res) => {
  try {
    const item = FollowThroughService.approve(req.params.id, 'user');
    res.json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/follow-ups/:id/send', async (req, res) => {
  try {
    const { explicitUserGesture } = req.body;
    const result = await FollowThroughService.executeSend(req.params.id, !!explicitUserGesture);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/follow-ups/:id/cancel', (req, res) => {
  try {
    const item = FollowThroughService.cancel(req.params.id, req.body.reason);
    res.json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/follow-ups/:id/audit', (req, res) => {
  res.json(FollowThroughService.getAuditLog(req.params.id));
});

apiRouter.post('/follow-ups/simulate-reply', (req, res) => {
  const { recipientEmail, replySnippet } = req.body;
  if (!recipientEmail) return res.status(400).json({ error: 'recipientEmail is required' });
  const result = EmailService.simulateIncomingReply(recipientEmail, replySnippet || 'Thanks for checking in. Everything looks great!');
  res.json(result);
});

apiRouter.get('/follow-ups/execution-records', (req, res) => {
  res.json(EmailService.getExecutionRecords(30));
});

// ==========================================
// 8. PRIVACY, SETTINGS & EXPORT/DELETE
// ==========================================
apiRouter.get('/settings', (req, res) => {
  const db = getDb();
  const privacy = db.prepare('SELECT * FROM privacy_settings LIMIT 1').get();
  const excludedDomains = db.prepare('SELECT * FROM excluded_domains ORDER BY domain ASC').all();
  res.json({ privacy, excludedDomains });
});

apiRouter.put('/settings', (req, res) => {
  const db = getDb();
  const { tracking_enabled, browser_wide_tracking, session_idle_threshold_minutes, local_only_ai, ai_provider, ai_api_key, retention_days } = req.body;

  db.prepare(`
    UPDATE privacy_settings 
    SET tracking_enabled = coalesce(?, tracking_enabled),
        browser_wide_tracking = coalesce(?, browser_wide_tracking),
        session_idle_threshold_minutes = coalesce(?, session_idle_threshold_minutes),
        local_only_ai = coalesce(?, local_only_ai),
        ai_provider = coalesce(?, ai_provider),
        ai_api_key = coalesce(?, ai_api_key),
        retention_days = coalesce(?, retention_days),
        updated_at = CURRENT_TIMESTAMP
  `).run(
    tracking_enabled !== undefined ? (tracking_enabled ? 1 : 0) : null,
    browser_wide_tracking !== undefined ? (browser_wide_tracking ? 1 : 0) : null,
    session_idle_threshold_minutes,
    local_only_ai !== undefined ? (local_only_ai ? 1 : 0) : null,
    ai_provider,
    ai_api_key,
    retention_days
  );

  const updated = db.prepare('SELECT * FROM privacy_settings LIMIT 1').get();
  broadcastEvent('SETTINGS_UPDATED', updated);
  res.json(updated);
});

apiRouter.post('/settings/excluded-domains', (req, res) => {
  const db = getDb();
  const { domain, reason } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  const id = uuidv4();
  try {
    db.prepare('INSERT INTO excluded_domains (id, domain, reason, is_active) VALUES (?, ?, ?, 1)').run(id, domain.toLowerCase().trim(), reason || 'User specified exclusion');
    res.status(201).json({ id, domain, reason });
  } catch (err: any) {
    res.status(400).json({ error: 'Domain already exists in exclusion list' });
  }
});

apiRouter.delete('/settings/excluded-domains/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM excluded_domains WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

apiRouter.post('/settings/export-data', (req, res) => {
  const db = getDb();
  const profile = db.prepare('SELECT * FROM profiles LIMIT 1').get();
  const projects = db.prepare('SELECT * FROM projects').all();
  const goals = db.prepare('SELECT * FROM goals').all();
  const tasks = db.prepare('SELECT * FROM tasks').all();
  const memories = db.prepare('SELECT * FROM memories').all();
  const notes = db.prepare('SELECT * FROM notes').all();
  const sessions = db.prepare('SELECT * FROM activity_sessions').all();
  const records = db.prepare('SELECT * FROM activity_records').all();
  const followUps = db.prepare('SELECT * FROM follow_ups').all();
  const audit = db.prepare('SELECT * FROM approval_audit').all();

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="continuity_ai_export.json"');
  res.json({
    exportDate: new Date().toISOString(),
    profile,
    projects,
    goals,
    tasks,
    memories,
    notes,
    sessions,
    records,
    followUps,
    audit
  });
});

apiRouter.post('/settings/delete-all-data', (req, res) => {
  const db = getDb();
  // Clear all non-setting tables
  db.exec(`
    DELETE FROM approval_audit;
    DELETE FROM execution_records;
    DELETE FROM follow_ups;
    DELETE FROM commitments;
    DELETE FROM notes;
    DELETE FROM memories;
    DELETE FROM activity_records;
    DELETE FROM activity_sessions;
    DELETE FROM tasks;
    DELETE FROM goals;
    DELETE FROM projects;
  `);

  broadcastEvent('ALL_DATA_WIPED', { timestamp: new Date().toISOString() });
  res.json({ success: true, message: 'All personal activity, memory, notes, and tasks have been permanently deleted.' });
});
