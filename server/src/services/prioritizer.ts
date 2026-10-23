import { getDb } from '../db/database.js';
import { getAIProvider } from '../ai/provider.js';
import { broadcastEvent } from '../sse.js';

export interface PriorityEvaluationOptions {
  availableMinutes?: number;
  projectId?: string;
}

export class PrioritizerService {
  /**
   * Deterministic Priority Calculation
   * Range: 0 to 100
   */
  static calculateTaskScore(task: any, availableMinutes = 90): { score: number; factors: Record<string, number>; isBlocked: boolean; blockerInfo?: string } {
    let score = 0;
    const factors: Record<string, number> = {};

    // 1. Deadline Urgency (Max 40 points)
    if (task.deadline) {
      const now = Date.now();
      const deadlineTime = new Date(task.deadline).getTime();
      const hoursRemaining = (deadlineTime - now) / 3600000;

      if (hoursRemaining < 0) {
        factors.deadline = 40; // Overdue
      } else if (hoursRemaining <= 4) {
        factors.deadline = 38;
      } else if (hoursRemaining <= 12) {
        factors.deadline = 32;
      } else if (hoursRemaining <= 24) {
        factors.deadline = 24;
      } else if (hoursRemaining <= 72) {
        factors.deadline = 15;
      } else {
        factors.deadline = 5;
      }
    } else {
      factors.deadline = 10;
    }
    score += factors.deadline;

    // 2. Goal / Priority Level (Max 25 points)
    const levelMap: Record<string, number> = {
      critical: 25,
      high: 18,
      medium: 10,
      low: 4
    };
    factors.level = levelMap[task.priority_level] || 10;
    score += factors.level;

    // 3. Dependencies & Blockers Check (Penalty up to -35 points)
    let isBlocked = false;
    let blockerInfo: string | undefined = task.blocker_reason;

    if (task.dependencies) {
      try {
        const depIds = JSON.parse(task.dependencies) as string[];
        if (depIds.length > 0) {
          const db = getDb();
          const uncompleted = db.prepare(`
            SELECT id, title, status FROM tasks 
            WHERE id IN (${depIds.map(() => '?').join(',')}) AND status != 'completed'
          `).all(...depIds) as any[];

          if (uncompleted.length > 0) {
            isBlocked = true;
            blockerInfo = `Prerequisite unfinished: "${uncompleted[0].title}"`;
            factors.dependencyPenalty = -35;
            score += factors.dependencyPenalty;
          }
        }
      } catch (e) {
        // Parse error ignored
      }
    }

    if (task.status === 'blocked' && !isBlocked) {
      isBlocked = true;
      factors.blockerPenalty = -30;
      score += factors.blockerPenalty;
    }

    // 4. Available Time Fit (Max 15 points)
    const estimated = task.estimated_minutes || 30;
    if (availableMinutes > 0) {
      if (estimated <= availableMinutes) {
        // Fits snugly inside user's available focus block
        factors.timeFit = 15;
      } else {
        // Exceeds available block
        factors.timeFit = 5;
      }
      score += factors.timeFit;
    }

    // 5. Confidence multiplier (Confidence that task remains incomplete)
    const confidence = task.confidence ?? 1.0;
    factors.confidenceMultiplier = confidence;
    score = Math.max(0, Math.min(100, score * confidence));

    return {
      score: Math.round(score * 10) / 10,
      factors,
      isBlocked,
      blockerInfo
    };
  }

  /**
   * Recalculate priority scores across all active tasks
   */
  static evaluateAllTasks(availableMinutes = 90) {
    const db = getDb();
    const tasks = db.prepare(`
      SELECT t.*, p.name as project_name, g.title as goal_title 
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN goals g ON t.goal_id = g.id
      WHERE t.status IN ('pending', 'in_progress', 'blocked')
    `).all() as any[];

    const updates = db.transaction(() => {
      for (const t of tasks) {
        const { score, isBlocked, blockerInfo } = this.calculateTaskScore(t, availableMinutes);
        const status = isBlocked ? 'blocked' : (t.status === 'blocked' ? 'pending' : t.status);
        db.prepare(`
          UPDATE tasks 
          SET priority_score = ?, status = ?, blocker_reason = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(score, status, blockerInfo || null, t.id);
      }
    });

    updates();
  }

  /**
   * Recommend the single best next action and generate natural language rationale
   */
  static async getRecommendedNextAction(availableMinutes = 90) {
    this.evaluateAllTasks(availableMinutes);
    const db = getDb();

    // Pick top unblocked task
    const topTask = db.prepare(`
      SELECT t.*, p.name as project_name, g.title as goal_title 
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN goals g ON t.goal_id = g.id
      WHERE t.status IN ('pending', 'in_progress')
      ORDER BY t.priority_score DESC
      LIMIT 1
    `).get() as any;

    if (!topTask) {
      return {
        hasRecommendation: false,
        message: 'No pending unblocked tasks found. You are fully caught up!'
      };
    }

    // Check if we need an AI explanation
    const ai = getAIProvider();
    const prompt = `Explain in 2-3 concise, natural sentences why this task is the recommended next action for the user:
Task: "${topTask.title}"
Project: "${topTask.project_name || 'General'}"
Estimated Time: ${topTask.estimated_minutes} min (User has ~${availableMinutes} min available)
Priority Score: ${topTask.priority_score}/100
Deadline: ${topTask.deadline || 'None'}
Status: ${topTask.status}

Give a direct, motivating recommendation acknowledging their time and downstream blockers.`;

    let explanation = topTask.ai_recommendation_reason;
    if (!explanation) {
      try {
        explanation = await ai.complete(prompt);
      } catch (e) {
        explanation = `You have approximately ${availableMinutes} minutes available. "${topTask.title}" has your highest priority score (${topTask.priority_score}/100) and fits your current focus window.`;
      }

      // Cache explanation
      db.prepare('UPDATE tasks SET ai_recommendation_reason = ?, is_ai_recommended = 1 WHERE id = ?').run(explanation, topTask.id);
    }

    return {
      hasRecommendation: true,
      task: {
        ...topTask,
        dependencies: JSON.parse(topTask.dependencies || '[]')
      },
      explanation,
      availableMinutes
    };
  }

  static updateTaskStatus(taskId: string, status: string) {
    const db = getDb();
    db.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, taskId);
    broadcastEvent('TASK_UPDATED', { taskId, status });
    return { success: true };
  }
}
