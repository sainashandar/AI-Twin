import { getDb } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeWebpageContent } from '../ai/promptSafety.js';
import { getAIProvider } from '../ai/provider.js';
import { broadcastEvent } from '../sse.js';

export interface PageActivityInput {
  url: string;
  title: string;
  content?: string;
  durationSeconds?: number;
  projectId?: string;
}

export class ActivityService {
  /**
   * Check if a URL or domain is in the exclusion list or matches sensitive patterns
   */
  static isDomainExcluded(urlOrDomain: string): { excluded: boolean; reason?: string } {
    const db = getDb();
    let hostname = urlOrDomain;
    try {
      if (urlOrDomain.startsWith('http')) {
        hostname = new URL(urlOrDomain).hostname;
      }
    } catch (e) {
      // Use as is
    }

    hostname = hostname.toLowerCase();

    // Check specific excluded domains table
    const excluded = db.prepare(`
      SELECT domain, reason FROM excluded_domains 
      WHERE is_active = 1 AND (domain = ? OR ? LIKE '%.' || domain)
    `).get(hostname, hostname) as { domain: string; reason: string } | undefined;

    if (excluded) {
      return { excluded: true, reason: excluded.reason || 'Domain on explicit exclusion list' };
    }

    // Default sensitive keywords in URL/domain
    const sensitiveKeywords = ['login', 'signin', 'auth', 'password', 'banking', 'checkout', 'token', 'secret'];
    for (const kw of sensitiveKeywords) {
      if (hostname.includes(kw) || urlOrDomain.toLowerCase().includes(`/${kw}`)) {
        return { excluded: true, reason: `Matches sensitive pattern: "${kw}"` };
      }
    }

    return { excluded: false };
  }

  /**
   * Record page visit activity, attach to active session or cluster into new session
   */
  static recordPageActivity(input: PageActivityInput) {
    const db = getDb();

    // Check tracking toggle
    const privacy = db.prepare('SELECT tracking_enabled, session_idle_threshold_minutes FROM privacy_settings LIMIT 1').get() as any;
    if (privacy && !privacy.tracking_enabled) {
      return { status: 'skipped', reason: 'Tracking is currently paused by user' };
    }

    // Sensitive check
    const exclusion = this.isDomainExcluded(input.url);
    if (exclusion.excluded) {
      return { status: 'excluded', reason: exclusion.reason };
    }

    let domain = 'unknown';
    try {
      domain = new URL(input.url).hostname;
    } catch (e) {
      domain = input.url;
    }

    // Sanitize untrusted DOM text to neutralize prompt injections
    const sanitized = sanitizeWebpageContent(input.content || '');

    const now = new Date();
    const thresholdMinutes = privacy?.session_idle_threshold_minutes || 25;
    const idleCutoff = new Date(now.getTime() - thresholdMinutes * 60000).toISOString();

    // Find active session
    let session = db.prepare(`
      SELECT id, title, page_count, start_time, end_time, project_id 
      FROM activity_sessions 
      WHERE status = 'active' AND (end_time >= ? OR start_time >= ?)
      ORDER BY end_time DESC LIMIT 1
    `).get(idleCutoff, idleCutoff) as any;

    if (!session) {
      // Create new session
      const sessionId = uuidv4();
      const sessionTitle = `Session on ${domain}`;
      db.prepare(`
        INSERT INTO activity_sessions (
          id, project_id, title, summary, start_time, end_time, status, page_count
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', 0)
      `).run(sessionId, input.projectId || null, sessionTitle, `Initial activity on ${input.title || domain}`, now.toISOString(), now.toISOString());

      session = { id: sessionId, title: sessionTitle, page_count: 0, project_id: input.projectId };
      broadcastEvent('SESSION_STARTED', { id: sessionId, title: sessionTitle, domain });
    }

    // Insert activity record
    const recordId = uuidv4();
    db.prepare(`
      INSERT INTO activity_records (
        id, session_id, url, domain, title, content_snippet, visit_time, duration_seconds, is_sensitive, user_approved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
    `).run(
      recordId,
      session.id,
      input.url,
      domain,
      input.title || domain,
      sanitized.safeSnippet,
      now.toISOString(),
      input.durationSeconds || 15
    );

    // Update session end time and page count
    db.prepare(`
      UPDATE activity_sessions 
      SET end_time = ?, page_count = page_count + 1, updated_at = ?
      WHERE id = ?
    `).run(now.toISOString(), now.toISOString(), session.id);

    broadcastEvent('ACTIVITY_RECORDED', {
      sessionId: session.id,
      recordId,
      url: input.url,
      title: input.title,
      domain,
      timestamp: now.toISOString(),
      flaggedInjectionThreats: sanitized.detectedThreats
    });

    return {
      status: 'recorded',
      sessionId: session.id,
      recordId,
      threatsNeutralized: sanitized.detectedThreats
    };
  }

  /**
   * Summarize a session using AI, extract decisions, blockers, tasks, and commit to episodic memory
   */
  static async summarizeSession(sessionId: string) {
    const db = getDb();
    const session = db.prepare('SELECT * FROM activity_sessions WHERE id = ?').get(sessionId) as any;
    if (!session) throw new Error('Session not found');

    const records = db.prepare('SELECT url, domain, title, content_snippet FROM activity_records WHERE session_id = ? ORDER BY visit_time ASC').all(sessionId) as any[];

    if (records.length === 0) {
      return session;
    }

    const ai = getAIProvider();
    const prompt = `Please summarize the following browser work session and identify key decisions, blockers, tasks, and next steps:
Session Title: ${session.title}
Pages Visited:
${records.map(r => `- [${r.domain}] ${r.title} (${r.url}): ${r.content_snippet || 'No text'}`).join('\n')}

Format as JSON with keys: title, summary, decisions (array), tasks_identified (array), blockers (array), next_steps (array).`;

    let summaryData: any = {};
    try {
      const response = await ai.complete(prompt, { responseFormat: 'json' });
      // Extract json from markdown block if needed
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      summaryData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch (e) {
      summaryData = {
        title: session.title,
        summary: `Researched and visited ${records.length} pages across ${new Set(records.map(r => r.domain)).size} domains.`,
        decisions: ['Reviewed reference documentation'],
        tasks_identified: [],
        blockers: [],
        next_steps: ['Continue project execution']
      };
    }

    const updatedTitle = summaryData.title || session.title;
    const updatedSummary = summaryData.summary || `Work session with ${records.length} pages visited.`;
    const decisions = JSON.stringify(summaryData.decisions || []);
    const tasks = JSON.stringify(summaryData.tasks_identified || []);
    const blockers = JSON.stringify(summaryData.blockers || []);
    const nextSteps = JSON.stringify(summaryData.next_steps || []);
    const evidence = JSON.stringify(records.map(r => r.url));

    db.prepare(`
      UPDATE activity_sessions 
      SET title = ?, summary = ?, decisions = ?, tasks_identified = ?, blockers = ?, next_steps = ?, evidence_references = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(updatedTitle, updatedSummary, decisions, tasks, blockers, nextSteps, evidence, sessionId);

    // Save into episodic memory
    const memoryId = uuidv4();
    const episodicContent = `Work Session: ${updatedTitle}. ${updatedSummary} Identified ${summaryData.decisions?.length || 0} decisions and ${summaryData.next_steps?.length || 0} next steps.`;
    db.prepare(`
      INSERT INTO memories (
        id, memory_type, content, project_id, source_type, source_id, source_url, source_title, confidence, evidence_notes
      ) VALUES (?, 'episodic', ?, ?, 'browser_session', ?, ?, ?, 1.0, ?)
    `).run(
      memoryId,
      episodicContent,
      session.project_id,
      sessionId,
      records[0]?.url || null,
      records[0]?.title || updatedTitle,
      `Summarized session from ${records.length} page visits`
    );

    broadcastEvent('SESSION_SUMMARIZED', { sessionId, title: updatedTitle });

    return {
      ...session,
      title: updatedTitle,
      summary: updatedSummary,
      decisions: summaryData.decisions || [],
      tasks_identified: summaryData.tasks_identified || [],
      blockers: summaryData.blockers || [],
      next_steps: summaryData.next_steps || []
    };
  }

  static getSessions(limit = 20) {
    const db = getDb();
    const sessions = db.prepare(`
      SELECT s.*, p.name as project_name, p.color as project_color 
      FROM activity_sessions s
      LEFT JOIN projects p ON s.project_id = p.id
      ORDER BY s.start_time DESC LIMIT ?
    `).all(limit) as any[];

    return sessions.map(s => ({
      ...s,
      decisions: JSON.parse(s.decisions || '[]'),
      tasks_identified: JSON.parse(s.tasks_identified || '[]'),
      blockers: JSON.parse(s.blockers || '[]'),
      next_steps: JSON.parse(s.next_steps || '[]'),
      evidence_references: JSON.parse(s.evidence_references || '[]')
    }));
  }

  static getSessionDetails(sessionId: string) {
    const db = getDb();
    const session = db.prepare(`
      SELECT s.*, p.name as project_name, p.color as project_color 
      FROM activity_sessions s
      LEFT JOIN projects p ON s.project_id = p.id
      WHERE s.id = ?
    `).get(sessionId) as any;

    if (!session) return null;

    const records = db.prepare(`
      SELECT * FROM activity_records WHERE session_id = ? ORDER BY visit_time ASC
    `).all(sessionId);

    return {
      ...session,
      decisions: JSON.parse(session.decisions || '[]'),
      tasks_identified: JSON.parse(session.tasks_identified || '[]'),
      blockers: JSON.parse(session.blockers || '[]'),
      next_steps: JSON.parse(session.next_steps || '[]'),
      evidence_references: JSON.parse(session.evidence_references || '[]'),
      records
    };
  }

  static deleteSession(sessionId: string) {
    const db = getDb();
    db.prepare('DELETE FROM activity_records WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM activity_sessions WHERE id = ?').run(sessionId);
    db.prepare('DELETE FROM memories WHERE source_id = ?').run(sessionId);
    broadcastEvent('SESSION_DELETED', { sessionId });
    return { success: true };
  }
}
