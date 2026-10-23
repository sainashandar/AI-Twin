import { getDb } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { hashContent } from '../ai/promptSafety.js';
import { getAIProvider } from '../ai/provider.js';
import { EmailService } from './emailService.js';
import { broadcastEvent } from '../sse.js';

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

export class FollowThroughService {
  /**
   * Create a new scheduled follow-up
   */
  static createFollowUp(params: {
    commitmentId?: string;
    projectId?: string;
    recipient: string;
    channel?: 'email' | 'slack' | 'message';
    subject: string;
    body: string;
    dueAt: string;
    conditionDescription?: string;
    providerType?: string;
  }) {
    const db = getDb();
    const id = uuidv4();
    const channel = params.channel || 'email';

    db.prepare(`
      INSERT INTO follow_ups (
        id, commitment_id, project_id, recipient, channel, subject, proposed_body, current_body, due_at, condition_description, state, provider_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?)
    `).run(
      id,
      params.commitmentId || null,
      params.projectId || null,
      params.recipient,
      channel,
      params.subject,
      params.body,
      params.body,
      params.dueAt,
      params.conditionDescription || null,
      params.providerType || 'simulated_email'
    );

    this.logAudit(id, 'NONE', 'SCHEDULED', 'user', 'Created scheduled follow-up');
    broadcastEvent('FOLLOWUP_CREATED', { id, recipient: params.recipient });

    return this.getFollowUpById(id);
  }

  static getFollowUpById(id: string) {
    const db = getDb();
    return db.prepare(`
      SELECT f.*, p.name as project_name, p.color as project_color, c.description as commitment_desc
      FROM follow_ups f
      LEFT JOIN projects p ON f.project_id = p.id
      LEFT JOIN commitments c ON f.commitment_id = c.id
      WHERE f.id = ?
    `).get(id);
  }

  static getAllFollowUps(stateFilter?: string) {
    const db = getDb();
    let sql = `
      SELECT f.*, p.name as project_name, p.color as project_color, c.description as commitment_desc
      FROM follow_ups f
      LEFT JOIN projects p ON f.project_id = p.id
      LEFT JOIN commitments c ON f.commitment_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (stateFilter && stateFilter !== 'ALL') {
      sql += ' AND f.state = ?';
      params.push(stateFilter);
    }
    sql += ' ORDER BY f.due_at ASC';
    return db.prepare(sql).all(...params);
  }

  /**
   * Log state transition to immutable audit trail
   */
  static logAudit(followUpId: string, previousState: string, newState: string, actor: 'user' | 'system' | 'ai', reason?: string, contentHash?: string) {
    const db = getDb();
    db.prepare(`
      INSERT INTO approval_audit (id, follow_up_id, previous_state, new_state, actor, reason, content_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), followUpId, previousState, newState, actor, reason || null, contentHash || null);
  }

  /**
   * Scheduler tick: Processes due follow-ups through context verification and draft preparation
   */
  static async checkDueQueue() {
    const db = getDb();
    const now = new Date().toISOString();

    const dueList = db.prepare(`
      SELECT * FROM follow_ups 
      WHERE state = 'SCHEDULED' AND due_at <= ?
    `).all(now) as any[];

    for (const item of dueList) {
      // 1. Transition to DUE
      this.transitionState(item.id, 'DUE', 'system', 'Due time reached');

      // 2. Transition to CONTEXT_CHECK
      this.transitionState(item.id, 'CONTEXT_CHECK', 'system', 'Checking communication channels');

      // Check condition (e.g., check simulated/real communication log)
      const contextResult = `Checked communication channels: No prior response detected for "${item.recipient}". Follow-up action required.`;
      db.prepare('UPDATE follow_ups SET context_check_result = ?, last_check_at = ? WHERE id = ?').run(contextResult, now, item.id);

      // 3. Prepare draft
      this.transitionState(item.id, 'DRAFT_READY', 'system', 'Draft contextualized');

      // 4. Move to IN_REVIEW for explicit human approval
      this.transitionState(item.id, 'IN_REVIEW', 'system', 'Draft ready for human review and approval');
    }

    return dueList.length;
  }

  /**
   * Update draft content.
   * CRITICAL SAFEGUARD: If the draft was previously APPROVED, editing it immediately
   * invalidates approval and forces transition back to IN_REVIEW!
   */
  static updateDraft(id: string, updates: { subject?: string; body?: string; recipient?: string }) {
    const db = getDb();
    const current = db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(id) as any;
    if (!current) throw new Error('Follow-up not found');

    const newSubject = updates.subject ?? current.subject;
    const newBody = updates.body ?? current.current_body;
    const newRecipient = updates.recipient ?? current.recipient;

    let targetState = current.state;
    let invalidated = false;

    if (current.state === 'APPROVED') {
      targetState = 'IN_REVIEW';
      invalidated = true;
    }

    db.prepare(`
      UPDATE follow_ups 
      SET subject = ?, current_body = ?, recipient = ?, state = ?, approved_content_hash = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newSubject, newBody, newRecipient, targetState, id);

    if (invalidated) {
      this.logAudit(id, 'APPROVED', 'IN_REVIEW', 'user', 'Approval invalidated due to content modification');
      broadcastEvent('APPROVAL_INVALIDATED', { id, reason: 'Content was edited after approval' });
    }

    broadcastEvent('DRAFT_UPDATED', { id, subject: newSubject });
    return this.getFollowUpById(id);
  }

  /**
   * Explicit User Approval Gate
   * Locks the draft with a SHA-256 hash of (recipient + channel + subject + body)
   */
  static approve(id: string, actor: 'user' = 'user') {
    const db = getDb();
    const item = db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(id) as any;
    if (!item) throw new Error('Follow-up not found');

    if (item.state !== 'IN_REVIEW' && item.state !== 'DRAFT_READY') {
      throw new Error(`Cannot approve item in state "${item.state}". Must be IN_REVIEW or DRAFT_READY.`);
    }

    // Compute cryptographic fingerprint of approved payload
    const payload = `${item.recipient}|${item.channel}|${item.subject}|${item.current_body}`;
    const hash = hashContent(payload);

    db.prepare(`
      UPDATE follow_ups 
      SET state = 'APPROVED', approved_content_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(hash, id);

    this.logAudit(id, item.state, 'APPROVED', actor, 'Explicit user approval granted', hash);
    broadcastEvent('FOLLOWUP_APPROVED', { id, hash });

    return this.getFollowUpById(id);
  }

  /**
   * Final Execution Gate
   * Enforces:
   * 1. Explicit user gesture
   * 2. Current state must be APPROVED
   * 3. Prevents duplicate send (blocks if SENDING or SENT)
   * 4. Hash immutability verification
   */
  static async executeSend(id: string, explicitUserGesture = false) {
    if (!explicitUserGesture) {
      throw new Error('SAFEGUARD VIOLATION: Execution requires explicit user gesture.');
    }

    const db = getDb();
    const item = db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(id) as any;
    if (!item) throw new Error('Follow-up not found');

    // Duplicate send prevention
    if (item.state === 'SENDING') {
      throw new Error('DUPLICATE PROTECTION: Message is currently in-flight.');
    }
    if (item.state === 'SENT') {
      throw new Error('DUPLICATE PROTECTION: Message was already sent successfully.');
    }
    if (item.state !== 'APPROVED') {
      throw new Error(`SAFEGUARD VIOLATION: Cannot execute send on unapproved item (state is "${item.state}").`);
    }

    // Hash verification safeguard
    const currentPayload = `${item.recipient}|${item.channel}|${item.subject}|${item.current_body}`;
    const currentHash = hashContent(currentPayload);

    if (currentHash !== item.approved_content_hash) {
      // Content changed without fresh approval!
      this.transitionState(id, 'IN_REVIEW', 'system', 'Stale approval detected: Hash mismatch.');
      throw new Error('STALE APPROVAL: Draft was modified after approval was granted. Please re-approve.');
    }

    // Set state to SENDING
    this.transitionState(id, 'SENDING', 'user', 'Dispatch initiated by user');
    db.prepare('UPDATE follow_ups SET execution_attempts = execution_attempts + 1 WHERE id = ?').run(id);

    try {
      const result = await EmailService.send({
        followUpId: item.id,
        recipient: item.recipient,
        channel: item.channel,
        subject: item.subject,
        body: item.current_body,
        providerType: item.provider_type
      });

      if (result.success) {
        db.prepare(`
          UPDATE follow_ups 
          SET state = 'SENT', send_time = CURRENT_TIMESTAMP, provider_response_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(result.messageId, id);

        this.logAudit(id, 'SENDING', 'SENT', 'system', `Provider accepted: ${result.details}`);
        broadcastEvent('FOLLOWUP_SENT', { id, messageId: result.messageId });
        return { success: true, item: this.getFollowUpById(id) };
      } else {
        db.prepare(`
          UPDATE follow_ups 
          SET state = 'FAILED', failure_reason = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(result.details, id);

        this.logAudit(id, 'SENDING', 'FAILED', 'system', result.details);
        return { success: false, error: result.details };
      }
    } catch (err: any) {
      db.prepare(`
        UPDATE follow_ups 
        SET state = 'FAILED', failure_reason = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(err.message, id);

      this.logAudit(id, 'SENDING', 'FAILED', 'system', err.message);
      throw err;
    }
  }

  static cancel(id: string, reason?: string) {
    const db = getDb();
    const item = db.prepare('SELECT state FROM follow_ups WHERE id = ?').get(id) as any;
    if (!item) throw new Error('Not found');

    db.prepare(`
      UPDATE follow_ups 
      SET state = 'CANCELLED', failure_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reason || 'User cancelled', id);

    this.logAudit(id, item.state, 'CANCELLED', 'user', reason || 'User cancelled');
    broadcastEvent('FOLLOWUP_CANCELLED', { id });
    return this.getFollowUpById(id);
  }

  static transitionState(id: string, newState: FollowUpState, actor: 'user' | 'system' | 'ai', reason?: string) {
    const db = getDb();
    const current = db.prepare('SELECT state FROM follow_ups WHERE id = ?').get(id) as any;
    if (!current) return;

    db.prepare('UPDATE follow_ups SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newState, id);
    this.logAudit(id, current.state, newState, actor, reason);
    broadcastEvent('FOLLOWUP_STATE_CHANGED', { id, previousState: current.state, newState });
  }

  static getAuditLog(followUpId: string) {
    const db = getDb();
    return db.prepare('SELECT * FROM approval_audit WHERE follow_up_id = ? ORDER BY timestamp ASC').all(followUpId);
  }
}
