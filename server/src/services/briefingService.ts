import { getDb } from '../db/database.js';
import { PrioritizerService } from './prioritizer.js';

export class BriefingService {
  static async getDailyBriefing() {
    const db = getDb();
    const now = new Date().toISOString();

    // 1. Most recent work session
    const lastSession = db.prepare(`
      SELECT s.*, p.name as project_name, p.color as project_color 
      FROM activity_sessions s
      LEFT JOIN projects p ON s.project_id = p.id
      ORDER BY s.end_time DESC LIMIT 1
    `).get() as any;

    let parsedLastSession = null;
    if (lastSession) {
      const records = db.prepare('SELECT url, domain, title FROM activity_records WHERE session_id = ? ORDER BY visit_time DESC LIMIT 5').all(lastSession.id);
      parsedLastSession = {
        ...lastSession,
        decisions: JSON.parse(lastSession.decisions || '[]'),
        blockers: JSON.parse(lastSession.blockers || '[]'),
        next_steps: JSON.parse(lastSession.next_steps || '[]'),
        recentPages: records
      };
    }

    // 2. Recommended Next Action
    const nextAction = await PrioritizerService.getRecommendedNextAction(90);

    // 3. Follow-ups requiring human attention (IN_REVIEW or DRAFT_READY)
    const pendingFollowUps = db.prepare(`
      SELECT f.*, p.name as project_name 
      FROM follow_ups f
      LEFT JOIN projects p ON f.project_id = p.id
      WHERE f.state IN ('IN_REVIEW', 'DRAFT_READY', 'DUE')
      ORDER BY f.due_at ASC
    `).all() as any[];

    // 4. Overdue or urgent tasks
    const urgentTasks = db.prepare(`
      SELECT t.*, p.name as project_name 
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.status IN ('pending', 'in_progress') AND (t.deadline <= ? OR t.priority_level = 'critical')
      ORDER BY t.priority_score DESC LIMIT 5
    `).all(new Date(Date.now() + 24 * 3600000).toISOString()) as any[];

    // 5. Active Projects summary
    const projects = db.prepare(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status != 'completed') as open_tasks_count,
        (SELECT COUNT(*) FROM goals WHERE project_id = p.id) as goals_count
      FROM projects p
      WHERE p.status = 'active'
      ORDER BY p.updated_at DESC LIMIT 4
    `).all();

    // 6. Recent quick notes
    const recentNotes = db.prepare(`
      SELECT id, title, content, created_at, tags 
      FROM notes 
      ORDER BY created_at DESC LIMIT 3
    `).all() as any[];

    return {
      greeting: this.getGreeting(),
      lastSession: parsedLastSession,
      recommendedNextAction: nextAction,
      pendingFollowUpsCount: pendingFollowUps.length,
      pendingFollowUps,
      urgentTasks,
      projects,
      recentNotes: recentNotes.map(n => ({ ...n, tags: JSON.parse(n.tags || '[]') })),
      generatedAt: now
    };
  }

  static getResumeContext() {
    const db = getDb();
    const lastSession = db.prepare(`
      SELECT s.*, p.name as project_name, p.color as project_color 
      FROM activity_sessions s
      LEFT JOIN projects p ON s.project_id = p.id
      ORDER BY s.end_time DESC LIMIT 1
    `).get() as any;

    if (!lastSession) {
      return {
        hasSession: false,
        message: 'No previous session recorded. Start browsing or work on a project to create your first session.'
      };
    }

    const pages = db.prepare(`
      SELECT url, domain, title, visit_time FROM activity_records 
      WHERE session_id = ? ORDER BY visit_time DESC
    `).all(lastSession.id);

    const relatedTasks = db.prepare(`
      SELECT id, title, status, priority_score FROM tasks 
      WHERE project_id = ? AND status != 'completed'
      ORDER BY priority_score DESC LIMIT 5
    `).all(lastSession.project_id);

    return {
      hasSession: true,
      session: {
        ...lastSession,
        decisions: JSON.parse(lastSession.decisions || '[]'),
        blockers: JSON.parse(lastSession.blockers || '[]'),
        next_steps: JSON.parse(lastSession.next_steps || '[]'),
        pages
      },
      relatedTasks
    };
  }

  private static getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }
}
