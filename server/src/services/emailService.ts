import { getDb } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { broadcastEvent } from '../sse.js';

export interface SendMessageParams {
  followUpId?: string;
  recipient: string;
  channel: 'email' | 'slack' | 'message';
  subject: string;
  body: string;
  providerType?: string;
}

export interface SendResult {
  success: boolean;
  provider: string;
  messageId: string;
  status: 'simulated_success' | 'success' | 'failure';
  details: string;
}

export class EmailService {
  /**
   * Execute message dispatch through simulated provider or configured real provider
   */
  static async send(params: SendMessageParams): Promise<SendResult> {
    const db = getDb();
    const provider = params.providerType || 'simulated_email';

    // Simulated provider execution
    if (provider === 'simulated_email') {
      const messageId = `sim-msg-${uuidv4().slice(0, 8)}`;

      // Simulate network verification delay (100ms)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Record in execution_records table
      db.prepare(`
        INSERT INTO execution_records (
          id, follow_up_id, provider, recipient, channel, subject, body, status, provider_message_id, details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'simulated_success', ?, ?)
      `).run(
        uuidv4(),
        params.followUpId || null,
        'simulated_email',
        params.recipient,
        params.channel,
        params.subject,
        params.body,
        messageId,
        'Delivered to simulated local outbox. Provider confirmed receipt.'
      );

      broadcastEvent('MESSAGE_SENT', {
        followUpId: params.followUpId,
        recipient: params.recipient,
        subject: params.subject,
        provider: 'simulated_email',
        messageId,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        provider: 'simulated_email',
        messageId,
        status: 'simulated_success',
        details: 'Simulated send successful. Message recorded in local delivery log.'
      };
    }

    // Fallback or external provider
    return {
      success: false,
      provider,
      messageId: '',
      status: 'failure',
      details: `Provider "${provider}" requires external API credentials or OAuth setup.`
    };
  }

  /**
   * Get all outgoing delivery execution logs
   */
  static getExecutionRecords(limit = 30) {
    const db = getDb();
    return db.prepare('SELECT * FROM execution_records ORDER BY created_at DESC LIMIT ?').all(limit);
  }

  /**
   * Simulate an incoming reply from a recipient (to test condition checks!)
   */
  static simulateIncomingReply(recipientEmail: string, replySnippet: string) {
    const db = getDb();
    // Find any follow_up or commitment awaiting reply from this recipient
    const followUps = db.prepare(`
      SELECT f.*, c.id as commitment_id 
      FROM follow_ups f
      LEFT JOIN commitments c ON f.commitment_id = c.id
      WHERE f.recipient = ? AND f.state IN ('SENT', 'AWAITING_REPLY', 'IN_REVIEW', 'DUE')
    `).all(recipientEmail) as any[];

    for (const fu of followUps) {
      db.prepare(`
        UPDATE follow_ups 
        SET state = 'COMPLETED', context_check_result = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(`Received verified reply: "${replySnippet}". Commitment fulfilled.`, fu.id);

      if (fu.commitment_id) {
        db.prepare(`
          UPDATE commitments 
          SET status = 'fulfilled', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(fu.commitment_id);
      }

      broadcastEvent('REPLY_RECEIVED', {
        followUpId: fu.id,
        recipient: recipientEmail,
        reply: replySnippet
      });
    }

    return {
      matchedFollowUps: followUps.length,
      message: `Simulated reply from ${recipientEmail} received and processed.`
    };
  }
}
