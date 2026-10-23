import { getDb } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { getAIProvider } from '../ai/provider.js';
import { broadcastEvent } from '../sse.js';

export type MemoryType = 'episodic' | 'project' | 'task' | 'goal' | 'commitment' | 'idea';

export interface AddMemoryInput {
  type: MemoryType;
  content: string;
  projectId?: string;
  sourceType: 'browser_session' | 'note' | 'task' | 'conversation' | 'manual';
  sourceId?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  confidence?: number;
  evidenceNotes?: string;
}

export class MemoryService {
  static addMemory(input: AddMemoryInput) {
    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO memories (
        id, memory_type, content, project_id, source_type, source_id, source_url, source_title, confidence, evidence_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.type,
      input.content,
      input.projectId || null,
      input.sourceType,
      input.sourceId || null,
      input.sourceUrl || null,
      input.sourceTitle || null,
      input.confidence ?? 1.0,
      input.evidenceNotes || null
    );

    broadcastEvent('MEMORY_CREATED', { id, type: input.type, content: input.content });
    return this.getMemoryById(id);
  }

  static getMemoryById(id: string) {
    const db = getDb();
    return db.prepare(`
      SELECT m.*, p.name as project_name, p.color as project_color 
      FROM memories m
      LEFT JOIN projects p ON m.project_id = p.id
      WHERE m.id = ?
    `).get(id);
  }

  static getAllMemories(options?: { type?: string; projectId?: string; limit?: number }) {
    const db = getDb();
    const limit = options?.limit || 50;

    let sql = `
      SELECT m.*, p.name as project_name, p.color as project_color 
      FROM memories m
      LEFT JOIN projects p ON m.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (options?.type) {
      sql += ' AND m.memory_type = ?';
      params.push(options.type);
    }
    if (options?.projectId) {
      sql += ' AND m.project_id = ?';
      params.push(options.projectId);
    }

    sql += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(limit);

    return db.prepare(sql).all(...params);
  }

  static searchMemories(query: string, limit = 20) {
    const db = getDb();
    if (!query || query.trim() === '') {
      return this.getAllMemories({ limit });
    }

    // Prepare search term for FTS5 (escape special chars and append wildcard)
    const sanitizedQuery = query
      .replace(/['"*^:]/g, ' ')
      .trim()
      .split(/\s+/)
      .map(word => `"${word}"*`)
      .join(' OR ');

    try {
      const ftsResults = db.prepare(`
        SELECT m.*, p.name as project_name, p.color as project_color, rank
        FROM memories_fts fts
        JOIN memories m ON fts.id = m.id
        LEFT JOIN projects p ON m.project_id = p.id
        WHERE memories_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(sanitizedQuery, limit) as any[];

      if (ftsResults.length > 0) {
        return ftsResults;
      }
    } catch (e) {
      // Fallback to LIKE if FTS syntax issue
    }

    // Fallback LIKE search
    const likeTerm = `%${query.trim()}%`;
    return db.prepare(`
      SELECT m.*, p.name as project_name, p.color as project_color
      FROM memories m
      LEFT JOIN projects p ON m.project_id = p.id
      WHERE m.content LIKE ? OR m.source_title LIKE ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(likeTerm, likeTerm, limit);
  }

  /**
   * Grounded Question Answering over Personal Memory
   */
  static async answerQuestion(question: string) {
    const db = getDb();
    const ai = getAIProvider();

    // 1. Retrieve top matching memories
    const relevantMemories = this.searchMemories(question, 8) as any[];

    // 2. Retrieve top recent sessions
    const recentSessions = db.prepare(`
      SELECT title, summary, decisions, blockers, next_steps, start_time 
      FROM activity_sessions 
      ORDER BY start_time DESC LIMIT 3
    `).all() as any[];

    // 3. Retrieve active tasks
    const activeTasks = db.prepare(`
      SELECT title, status, priority_score, deadline 
      FROM tasks 
      WHERE status IN ('pending', 'in_progress')
      ORDER BY priority_score DESC LIMIT 5
    `).all() as any[];

    // Format context with explicit source tracking
    const memoryContext = relevantMemories.map((m, idx) => 
      `[Memory #${idx + 1} (${m.memory_type.toUpperCase()})] ${m.content} (Source: ${m.source_title || m.source_url || 'Internal Record'}, Confidence: ${m.confidence})`
    ).join('\n');

    const sessionContext = recentSessions.map(s => 
      `[Session] ${s.title}: ${s.summary} Decisions: ${s.decisions}. Blockers: ${s.blockers}. Next steps: ${s.next_steps}`
    ).join('\n');

    const prompt = `You are Continuity AI, a personal continuity agent. Answer the user's question accurately using ONLY the retrieved personal memory context below.
Strict instructions:
1. Always ground your claims in the provided memories and cite the source name/type in parentheses.
2. If the user asks about something not present in the memory context, acknowledge the missing information directly. Never fabricate decisions, tasks, or URLs.
3. Be concise, actionable, and structured.

--- RETRIEVED MEMORIES ---
${memoryContext || 'No directly matching memories found.'}

--- RECENT SESSIONS ---
${sessionContext}

--- ACTIVE TASKS ---
${activeTasks.map(t => `- ${t.title} (Status: ${t.status}, Priority: ${t.priority_score})`).join('\n')}

User Question: "${question}"`;

    const answer = await ai.complete(prompt);

    const sources = relevantMemories.map(m => ({
      id: m.id,
      type: m.memory_type,
      title: m.source_title || `${m.memory_type.toUpperCase()} Memory`,
      url: m.source_url || null,
      contentSnippet: m.content.slice(0, 140) + '...'
    }));

    return {
      question,
      answer,
      sources,
      provider: ai.name
    };
  }

  static deleteMemory(id: string) {
    const db = getDb();
    db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    broadcastEvent('MEMORY_DELETED', { id });
    return { success: true };
  }
}
