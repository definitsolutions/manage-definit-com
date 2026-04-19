import OpenAI from 'openai';
import prisma from '@/lib/prisma';

/**
 * AI service for Teams task classification.
 * Refines task detection: filters false positives, extracts better titles,
 * assigns priority, and suggests next actions.
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

  private async callWithRetry(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    opts: { json?: boolean } = {},
  ): Promise<string | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages,
          temperature: 0.3,
          max_tokens: 400,
          ...(opts.json ? { response_format: { type: 'json_object' as const } } : {}),
        });
        return response.choices[0]?.message?.content ?? null;
      } catch (err: unknown) {
        const status = (err as { status?: number }).status;
        if (status === 429 && attempt < 2) {
          const wait = [5000, 15000, 30000][attempt] ?? 30000;
          console.log(`[AI] Rate limited, waiting ${wait / 1000}s`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        throw err;
      }
    }
    return null;
  }

  /**
   * Classify a detected task: confirm it's real, refine title, set priority.
   */
  async classifyTask(taskId: string): Promise<boolean> {
    const task = await prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        chat: true,
        messages: { orderBy: { receivedAt: 'asc' }, take: 5 },
      },
    });

    // Get surrounding context — a few messages before/after
    const contextMessages = await prisma.chatMessage.findMany({
      where: { chatId: task.chatId },
      orderBy: { receivedAt: 'asc' },
      take: 10,
    });

    const conversation = contextMessages
      .map(m => `[${m.isFromMe ? 'ME' : m.senderName ?? m.senderEmail}] ${m.content}`)
      .join('\n---\n');

    const systemPrompt = `You analyze Teams chat messages for a managed IT services company owner. You determine if a message contains a genuine actionable task.

Evaluate the message and respond in JSON:
{
  "isTask": true/false,
  "confidence": 0.0-1.0,
  "title": "concise task description (imperative, 5-10 words)",
  "priority": "low|medium|high|critical",
  "suggestedAction": "what should be done next (1 sentence)",
  "explanation": "why this is or isn't a task (1 sentence)"
}

Rules:
- Casual conversation is NOT a task (greetings, small talk, FYI messages)
- Questions asking for info ARE tasks if they need a response
- Requests for action ARE tasks
- Self-commitments ("I'll do X") ARE tasks
- Status updates without action needed are NOT tasks
- "Thanks" / acknowledgements are NOT tasks`;

    const userPrompt = `Chat: ${task.chat.topic ?? 'Direct message'}
Direction: ${task.direction}
Source message: "${task.context}"

Surrounding conversation:
${conversation}`;

    try {
      const content = await this.callWithRetry(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        { json: true },
      );

      if (!content) return false;

      const parsed = JSON.parse(content);

      await prisma.task.update({
        where: { id: taskId },
        data: {
          aiConfidence: parsed.confidence ?? 0,
          title: parsed.title ?? task.title,
          priority: mapPriority(parsed.priority),
          suggestedAction: parsed.suggestedAction ?? null,
          aiExplanation: parsed.explanation ?? null,
        },
      });

      // If AI says it's not a task with high confidence, dismiss it
      if (!parsed.isTask && (parsed.confidence ?? 0) < 0.3) {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: 'DISMISSED', dismissedAt: new Date() },
        });
      }

      return true;
    } catch (err) {
      console.error(`[AI] Task classification failed for ${taskId}:`, err instanceof Error ? err.message : err);
      return false;
    }
  }

  /**
   * Batch classify new tasks. Max 5 per run with throttling.
   */
  async classifyNewTasks(userId: string): Promise<number> {
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        aiConfidence: 0, // not yet classified
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      orderBy: { detectedAt: 'desc' },
      take: 5,
    });

    let classified = 0;
    for (const task of tasks) {
      const success = await this.classifyTask(task.id);
      if (success) classified++;
      await new Promise(r => setTimeout(r, 3000));
    }
    return classified;
  }
}

function mapPriority(p: string | undefined): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  switch (p?.toLowerCase()) {
    case 'critical': return 'CRITICAL';
    case 'high': return 'HIGH';
    case 'low': return 'LOW';
    default: return 'MEDIUM';
  }
}

export const aiService = new AIService();
