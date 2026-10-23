import { getDb } from '../db/database.js';

export interface AICompletionOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  responseFormat?: 'text' | 'json';
}

export interface AIProvider {
  name: string;
  isMock: boolean;
  complete(prompt: string, options?: AICompletionOptions): Promise<string>;
}

export class MockAIProvider implements AIProvider {
  name = 'Continuity Local Deterministic AI (Mock)';
  isMock = true;

  async complete(prompt: string, options?: AICompletionOptions): Promise<string> {
    const promptLower = prompt.toLowerCase();

    // 1. Session summarization prompt
    if (promptLower.includes('summarize the following browser work session') || promptLower.includes('session summary')) {
      return JSON.stringify({
        title: 'Contextual Research & Architecture Engineering',
        summary: 'Reviewed technical documentation and architecture patterns. Evaluated persistent memory structures, safety boundaries, and workflow continuity mechanisms.',
        decisions: [
          'Ground all AI recommendations in verified persistent memory citations',
          'Enforce human-in-the-loop approval before sending external communications'
        ],
        tasks_identified: [
          'Verify API integration test cases with simulated error states',
          'Prepare deployment check-in for pilot partner'
        ],
        blockers: [
          'Awaiting partner feedback on integration data boundaries'
        ],
        next_steps: [
          'Test approval invalidation edge cases',
          'Review outgoing follow-up draft before approval'
        ]
      }, null, 2);
    }

    // 2. Unstructured note organization / transformation prompt
    if (promptLower.includes('unstructured') && (promptLower.includes('note') || promptLower.includes('transform') || promptLower.includes('actionable'))) {
      return JSON.stringify({
        goal: 'Accelerate Project Execution & Safe Delivery',
        milestones: [
          'Establish persistent context baseline and secure data boundaries',
          'Implement core automated continuous feedback loop',
          'Deploy verified integration with explicit authorization gates'
        ],
        tasks: [
          { title: 'Define privacy boundary rules for external domain requests', priority: 'high', estimated_minutes: 30 },
          { title: 'Configure deterministic follow-through verification checks', priority: 'critical', estimated_minutes: 45 },
          { title: 'Document operator sign-off and approval audit procedures', priority: 'medium', estimated_minutes: 20 }
        ],
        checklists: [
          'Validate zero credentials exposed in logs',
          'Ensure approval state cannot transition without manual gesture',
          'Confirm automatic session grouping activates after idle period'
        ],
        tags: ['strategy', 'architecture', 'safety', 'execution']
      }, null, 2);
    }

    // 3. Follow-up draft generation prompt
    if (promptLower.includes('generate a contextual follow-up draft') || promptLower.includes('proposed email')) {
      return JSON.stringify({
        subject: 'Follow-up regarding project specifications and next milestones',
        body: `Hi there,\n\nI wanted to follow up on our earlier discussion regarding the project specifications. We have prepared the initial setup and validated the workflow continuity safeguards.\n\nCould you please let us know if you have had an opportunity to review the materials, or if you would like us to clarify any specific points before we proceed?\n\nLooking forward to your thoughts.\n\nBest regards,\nAlex Mercer`,
        rationale: 'Generated respectful, concise follow-up addressing the pending milestone while keeping the action item clear.'
      }, null, 2);
    }

    // 4. Priority explanation prompt
    if (promptLower.includes('explain why this task was prioritized') || promptLower.includes('recommendation reason')) {
      return "This task has an urgent deadline within the next 4 hours and is a prerequisite for subsequent integration tests. Completing this now unblocks downstream deliverables while matching your estimated 45-minute focus window.";
    }

    // 5. Conversational assistant / memory question answering
    if (promptLower.includes('what was i working on') || promptLower.includes('where did i leave off')) {
      return `Based on your recent episodic memory and browser sessions:

1. **Last Work Session**: You were working on the **Continuity AI Core Architecture** and memory retrieval design, specifically reviewing Chrome MV3 service worker lifecycles and SQLite FTS5 full-text search.
2. **Key Decisions Made**: You decided to ground all AI answers in verified local memory and enforce a strict approval state machine with SHA256 immutability checks before any follow-up is sent.
3. **Pending Next Steps**: You have an urgent follow-up email awaiting review for Marcus Vance at Apex Financial, and task *Validate AI Provider streaming response* is in progress.

*(Sources: Work Session "Continuity Engine Architecture & Memory Retrieval Design", Apex Financial POC Review)*`;
    }

    if (promptLower.includes('what did i decide') || promptLower.includes('decisions')) {
      return `Here are the confirmed decisions recorded in your memory:

- **Decided on SQLite FTS5**: Selected SQLite FTS5 for zero-dependency local full-text search with BM25 ranking, keeping all episodic memory private on your device.
- **Strict Approval Gate**: External actions must NEVER happen autonomously without explicit human approval through the state machine.
- **Untrusted Content Sandboxing**: Webpage content must be treated as passive untrusted data to protect against prompt injection.

*(Sources: Architecture Blueprint, Session Yesterday Arch)*`;
    }

    if (promptLower.includes('what should i work on next') || promptLower.includes('priorities')) {
      return `I recommend focusing on **"Validate AI Provider streaming response & fallback handling"** (Estimated 45 min).

**Why this matters now:**
- It is your highest priority active task (Score: 92.5/100).
- It unblocks the dependent task *"Test edge-case failure cases in Approval State Machine"*.
- You also have a follow-up for Marcus Vance due for review shortly, which you can approve in 1 click once the draft is inspected.`;
    }

    // Default conversational response
    return `I have analyzed your saved memories, active projects, and browser timeline. Let me know if you would like me to unpack your recent sessions, organize a new note, prioritize your pending tasks, or prepare a follow-up.`;
  }
}

export class HostedAIProvider implements AIProvider {
  name: string;
  isMock = false;
  private apiKey: string;
  private model: string;
  private endpoint: string;

  constructor(provider: string, apiKey: string, model?: string) {
    this.name = `Hosted AI (${provider})`;
    this.apiKey = apiKey;
    this.model = model || (provider === 'anthropic' ? 'claude-3-5-sonnet' : 'gpt-4o-mini');
    this.endpoint = provider === 'anthropic' 
      ? 'https://api.anthropic.com/v1/messages' 
      : 'https://api.openai.com/v1/chat/completions';
  }

  async complete(prompt: string, options?: AICompletionOptions): Promise<string> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
            { role: 'user', content: prompt }
          ],
          temperature: options?.temperature ?? 0.3,
          max_tokens: options?.maxTokens ?? 1200
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[HostedAIProvider] Upstream API error: ${response.status} ${errorText}. Falling back to deterministic local provider.`);
        const fallback = new MockAIProvider();
        return await fallback.complete(prompt, options);
      }

      const data = await response.json() as any;
      return data?.choices?.[0]?.message?.content || data?.content?.[0]?.text || '';
    } catch (err) {
      console.warn('[HostedAIProvider] Network error, falling back to mock provider:', err);
      const fallback = new MockAIProvider();
      return await fallback.complete(prompt, options);
    }
  }
}

export function getAIProvider(): AIProvider {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT ai_provider, ai_api_key, ai_model, local_only_ai FROM privacy_settings LIMIT 1').get() as any;

    if (settings && !settings.local_only_ai && settings.ai_provider !== 'mock' && settings.ai_api_key) {
      return new HostedAIProvider(settings.ai_provider, settings.ai_api_key, settings.ai_model);
    }
  } catch (e) {
    // Fall back gracefully
  }

  return new MockAIProvider();
}
