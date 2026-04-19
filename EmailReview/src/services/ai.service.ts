import OpenAI from 'openai';
import prisma from '@/lib/prisma';
import type { Message } from '@prisma/client';

/**
 * AIService uses OpenAI to enhance thread analysis with summarization,
 * classification, suggested actions, and draft reply generation.
 *
 * Includes rate-limit handling: throttles requests and retries on 429.
 */
export class AIService {
  private _client: OpenAI | null = null;

  private get client(): OpenAI {
    if (!this._client) {
      this._client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this._client;
  }

  private get model(): string {
    return process.env.OPENAI_MODEL ?? 'gpt-4o';
  }

  /**
   * Call OpenAI with retry on rate limit (429).
   * Waits the requested retry-after time, up to 3 attempts.
   */
  private async callWithRetry(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    opts: { temperature?: number; max_tokens?: number; json?: boolean } = {},
  ): Promise<string | null> {
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages,
          temperature: opts.temperature ?? 0.3,
          max_tokens: opts.max_tokens ?? 500,
          ...(opts.json ? { response_format: { type: 'json_object' as const } } : {}),
        });
        return response.choices[0]?.message?.content ?? null;
      } catch (err: unknown) {
        const status = (err as { status?: number }).status;
        if (status === 429 && attempt < maxRetries - 1) {
          // Parse retry-after from error or default to escalating wait
          const waitMs = this.getRetryDelay(err, attempt);
          console.log(`[AI] Rate limited, waiting ${Math.round(waitMs / 1000)}s before retry ${attempt + 2}/${maxRetries}`);
          await sleep(waitMs);
          continue;
        }
        throw err;
      }
    }
    return null;
  }

  private getRetryDelay(err: unknown, attempt: number): number {
    // Try to parse retry-after from the error message
    const msg = err instanceof Error ? err.message : String(err);
    const match = msg.match(/try again in (\d+(?:\.\d+)?)(?:ms|s)/i);
    if (match) {
      const val = parseFloat(match[1]);
      // If it says "ms", use as-is; otherwise treat as seconds
      return msg.includes('ms') ? val + 500 : val * 1000 + 500;
    }
    // Default: escalating backoff (5s, 15s, 30s)
    return [5000, 15000, 30000][attempt] ?? 30000;
  }

  /**
   * Analyze a thread: summarize, classify, suggest action, explain flags.
   */
  async analyzeThread(threadId: string): Promise<boolean> {
    const thread = await prisma.thread.findUniqueOrThrow({
      where: { id: threadId },
      include: {
        messages: { orderBy: { receivedAt: 'asc' } },
        flags: { where: { isResolved: false } },
      },
    });

    const conversationText = this.buildConversationText(thread);
    const flagSummary = thread.flags.map((f) => `[${f.flagType}] ${f.description}`).join('\n');

    const systemPrompt = `You are an executive assistant for a managed IT services company. You analyze email threads to help the owner stay on top of client communications.

Your job:
1. Summarize the thread concisely (2-3 sentences max).
2. Classify whether the thread needs action: "needs_action", "monitoring", "resolved", or "informational".
3. Assign priority: "critical", "high", "medium", or "low".
4. Suggest a specific next action (1 sentence).
5. Explain why this thread was flagged (1-2 sentences referencing the detection flags).

Respond in JSON format:
{
  "summary": "...",
  "classification": "needs_action|monitoring|resolved|informational",
  "priority": "critical|high|medium|low",
  "suggestedAction": "...",
  "explanation": "..."
}`;

    const userPrompt = `Thread subject: ${thread.subject}
Messages in thread (${thread.messageCount} total):

${conversationText}

Detection flags:
${flagSummary || 'No flags detected.'}

Thread stats:
- Client messages: ${thread.clientMessageCount}
- Internal messages: ${thread.internalMessageCount}
- Last sender is client: ${thread.lastSenderIsClient}
- Priority score (rules engine): ${thread.priorityScore}/100`;

    try {
      const content = await this.callWithRetry(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.3, max_tokens: 500, json: true },
      );

      if (!content) return false;

      const parsed = JSON.parse(content);

      await prisma.aIAnalysis.create({
        data: {
          threadId,
          summary: parsed.summary ?? 'Unable to summarize.',
          classification: parsed.classification ?? 'monitoring',
          priority: parsed.priority ?? 'medium',
          suggestedAction: parsed.suggestedAction ?? null,
          explanation: parsed.explanation ?? null,
          model: this.model,
        },
      });

      return true;
    } catch (err) {
      // Don't write a "failed" record — just log and skip
      console.error(`[AI] Analysis failed for thread ${threadId}:`, err instanceof Error ? err.message : err);
      return false;
    }
  }

  /**
   * Generate a draft reply for a thread.
   */
  async generateDraftReply(threadId: string): Promise<string> {
    const thread = await prisma.thread.findUniqueOrThrow({
      where: { id: threadId },
      include: { messages: { orderBy: { receivedAt: 'asc' } } },
    });

    const conversationText = this.buildConversationText(thread);

    const systemPrompt = `You are drafting an email reply on behalf of the owner of a managed IT services company. Write a professional, concise reply appropriate for a client-facing email.

Guidelines:
- Be helpful and professional
- Acknowledge the client's concern or request
- Provide a clear next step or response
- Keep it concise (3-5 sentences typical)
- Don't make specific technical promises unless clearly appropriate
- Sign off with just "Best regards" (the signature block is added automatically)

Return only the email body text, no subject line.`;

    const userPrompt = `Write a reply to this thread:

Subject: ${thread.subject}

Conversation:
${conversationText}

The latest message is from: ${thread.lastSenderEmail}`;

    const content = await this.callWithRetry(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.5, max_tokens: 400 },
    );

    const draft = content ?? 'Unable to generate draft.';

    // Store the draft on the latest analysis
    const latestAnalysis = await prisma.aIAnalysis.findFirst({
      where: { threadId },
      orderBy: { analyzedAt: 'desc' },
    });

    if (latestAnalysis) {
      await prisma.aIAnalysis.update({
        where: { id: latestAnalysis.id },
        data: { draftReply: draft },
      });
    }

    return draft;
  }

  /**
   * Batch analyze flagged threads with throttling.
   * Processes up to 5 threads per sync, with 3s delay between each.
   */
  async analyzeAllFlaggedThreads(userId: string): Promise<number> {
    const threads = await prisma.thread.findMany({
      where: {
        userId,
        status: 'OPEN',
        flags: { some: { isResolved: false } },
      },
      include: { aiAnalyses: { orderBy: { analyzedAt: 'desc' }, take: 1 } },
      orderBy: { priorityScore: 'desc' }, // highest priority first
    });

    let analyzed = 0;
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const maxPerBatch = 5; // limit per sync to avoid rate limits

    for (const thread of threads) {
      if (analyzed >= maxPerBatch) break;

      const lastAnalysis = thread.aiAnalyses[0];

      // Skip if successfully analyzed in the last 6 hours
      if (lastAnalysis && lastAnalysis.analyzedAt > sixHoursAgo && !lastAnalysis.summary.includes('failed')) {
        continue;
      }

      const success = await this.analyzeThread(thread.id);
      if (success) analyzed++;

      // Throttle: wait 3 seconds between requests to stay under TPM limits
      if (analyzed < maxPerBatch) {
        await sleep(3000);
      }
    }

    return analyzed;
  }

  /**
   * Build a human-readable conversation transcript for AI consumption.
   */
  private buildConversationText(thread: { messages: Message[] }): string {
    return thread.messages
      .map((m) => {
        const dir = m.direction === 'INBOUND' ? '← IN' : '→ OUT';
        const time = m.receivedAt.toISOString().slice(0, 16).replace('T', ' ');
        return `[${dir}] ${time} | From: ${m.senderName ?? m.senderEmail}\n${m.bodyPreview}\n`;
      })
      .join('\n---\n');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const aiService = new AIService();
