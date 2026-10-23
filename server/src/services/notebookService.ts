import { getDb } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { getAIProvider } from '../ai/provider.js';
import { broadcastEvent } from '../sse.js';

export interface CreateNoteInput {
  title?: string;
  content: string;
  projectId?: string;
  tags?: string[];
  isPinned?: boolean;
  position_x?: number;
  position_y?: number;
  color?: string;
}

export class NotebookService {
  static async createNote(input: CreateNoteInput) {
    const db = getDb();
    const id = uuidv4();
    const title = input.title || this.extractTitle(input.content);
    const tags = JSON.stringify(input.tags || ['quick-capture']);
    const posX = input.position_x ?? 80;
    const posY = input.position_y ?? 80;
    const color = input.color ?? 'amber';

    // Persist note immediately to preserve original user thought
    db.prepare(`
      INSERT INTO notes (
        id, project_id, title, content, raw_input, tags, is_pinned, position_x, position_y, color, accepted_structure
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      id,
      input.projectId || null,
      title,
      input.content,
      input.content,
      tags,
      input.isPinned ? 1 : 0,
      posX,
      posY,
      color
    );

    // Also persist as an Idea/Note memory
    db.prepare(`
      INSERT INTO memories (
        id, memory_type, content, project_id, source_type, source_id, source_title, confidence
      ) VALUES (?, 'idea', ?, ?, 'note', ?, ?, 0.9)
    `).run(uuidv4(), input.content, input.projectId || null, id, title);

    broadcastEvent('NOTE_CREATED', { id, title });

    // Generate AI structural suggestions in the background / return immediately
    const note = this.getNoteById(id);
    this.generateStructuralSuggestions(id, input.content, input.projectId).catch(err => {
      console.warn('AI transformation suggestion error:', err);
    });

    return note;
  }

  static async generateStructuralSuggestions(noteId: string, content: string, projectId?: string) {
    const db = getDb();
    const ai = getAIProvider();

    const prompt = `Transform the following unstructured personal note into an actionable project breakdown:
Note Content: "${content}"

Analyze and extract:
1. Proposed Goal (high-level objective)
2. Milestones (key progressive stages)
3. Actionable Tasks (with title, priority: critical/high/medium/low, estimated_minutes)
4. Checklists (concrete verification steps)
5. Suggested tags

Return strictly valid JSON with keys: goal, milestones (array of strings), tasks (array of { title, priority, estimated_minutes }), checklists (array of strings), tags (array of strings).`;

    let suggestedStructure: any = {};
    try {
      const response = await ai.complete(prompt, { responseFormat: 'json' });
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      suggestedStructure = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch (e) {
      suggestedStructure = {
        goal: 'Execute on Captured Note Plan',
        milestones: ['Initial Setup', 'Implementation', 'Review'],
        tasks: [{ title: 'Review and refine captured note items', priority: 'medium', estimated_minutes: 20 }],
        checklists: ['Confirm requirements', 'Verify completeness'],
        tags: ['action-item']
      };
    }

    db.prepare(`
      UPDATE notes 
      SET ai_suggested_structure = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(suggestedStructure), noteId);

    broadcastEvent('NOTE_SUGGESTIONS_READY', { noteId, suggestedStructure });
    return suggestedStructure;
  }

  /**
   * User explicitly accepts AI structure to instantiate real Goals, Tasks, and Checklists
   */
  static acceptStructure(noteId: string) {
    const db = getDb();
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as any;
    if (!note || !note.ai_suggested_structure) {
      throw new Error('No AI suggestions available to accept.');
    }

    const structure = JSON.parse(note.ai_suggested_structure);
    const createdTaskIds: string[] = [];

    const tx = db.transaction(() => {
      // Create Goal if suggested
      let goalId: string | null = null;
      if (structure.goal) {
        goalId = uuidv4();
        db.prepare(`
          INSERT INTO goals (id, project_id, title, description, target_date, status)
          VALUES (?, ?, ?, ?, ?, 'in_progress')
        `).run(
          goalId,
          note.project_id,
          structure.goal,
          `Generated from note: "${note.title}"`,
          new Date(Date.now() + 14 * 86400000).toISOString()
        );
      }

      // Create Tasks
      if (Array.isArray(structure.tasks)) {
        for (const t of structure.tasks) {
          const taskId = uuidv4();
          createdTaskIds.push(taskId);
          db.prepare(`
            INSERT INTO tasks (
              id, project_id, goal_id, title, description, priority_level, estimated_minutes, status, confidence
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0.9)
          `).run(
            taskId,
            note.project_id,
            goalId,
            t.title,
            `From note: ${note.title}`,
            t.priority || 'medium',
            t.estimated_minutes || 30
          );
        }
      }

      // Mark note as accepted
      db.prepare(`
        UPDATE notes 
        SET accepted_structure = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(noteId);
    });

    tx();

    broadcastEvent('NOTE_STRUCTURE_ACCEPTED', { noteId, createdTaskCount: createdTaskIds.length });
    return { success: true, createdTaskCount: createdTaskIds.length };
  }

  static getAllNotes(projectId?: string) {
    const db = getDb();
    let sql = `
      SELECT n.*, p.name as project_name, p.color as project_color 
      FROM notes n
      LEFT JOIN projects p ON n.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (projectId) {
      sql += ' AND n.project_id = ?';
      params.push(projectId);
    }
    sql += ' ORDER BY n.is_pinned DESC, n.updated_at DESC';

    const notes = db.prepare(sql).all(...params) as any[];
    return notes.map(n => ({
      ...n,
      tags: JSON.parse(n.tags || '[]'),
      ai_suggested_structure: n.ai_suggested_structure ? JSON.parse(n.ai_suggested_structure) : null
    }));
  }

  static getNoteById(id: string) {
    const db = getDb();
    const note = db.prepare(`
      SELECT n.*, p.name as project_name, p.color as project_color 
      FROM notes n
      LEFT JOIN projects p ON n.project_id = p.id
      WHERE n.id = ?
    `).get(id) as any;

    if (!note) return null;
    return {
      ...note,
      tags: JSON.parse(note.tags || '[]'),
      ai_suggested_structure: note.ai_suggested_structure ? JSON.parse(note.ai_suggested_structure) : null
    };
  }

  static updateNote(id: string, updates: { 
    title?: string; 
    content?: string; 
    tags?: string[]; 
    isPinned?: boolean; 
    projectId?: string;
    position_x?: number;
    position_y?: number;
    color?: string;
  }) {
    const db = getDb();
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as any;
    if (!note) throw new Error('Note not found');

    const title = updates.title ?? note.title;
    const content = updates.content ?? note.content;
    const tags = updates.tags ? JSON.stringify(updates.tags) : note.tags;
    const isPinned = updates.isPinned !== undefined ? (updates.isPinned ? 1 : 0) : note.is_pinned;
    const projectId = updates.projectId !== undefined ? updates.projectId : note.project_id;
    const posX = updates.position_x !== undefined ? updates.position_x : (note.position_x ?? 80);
    const posY = updates.position_y !== undefined ? updates.position_y : (note.position_y ?? 80);
    const color = updates.color !== undefined ? updates.color : (note.color ?? 'amber');

    db.prepare(`
      UPDATE notes 
      SET title = ?, content = ?, tags = ?, is_pinned = ?, project_id = ?, position_x = ?, position_y = ?, color = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, content, tags, isPinned, projectId, posX, posY, color, id);

    broadcastEvent('NOTE_UPDATED', { id, title });
    return this.getNoteById(id);
  }

  static deleteNote(id: string) {
    const db = getDb();
    db.prepare('DELETE FROM notes WHERE id = ?').run(id);
    broadcastEvent('NOTE_DELETED', { id });
    return { success: true };
  }

  private static extractTitle(content: string): string {
    const firstLine = content.split('\n')[0].replace(/[#*_-]/g, '').trim();
    if (firstLine.length > 0) {
      return firstLine.slice(0, 50);
    }
    return `Note ${new Date().toLocaleDateString()}`;
  }
}
