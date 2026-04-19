import prisma from '@/lib/prisma';
import { normalizeEmail } from '@/lib/utils';
import type { TaskDirection } from '@prisma/client';

/**
 * Deterministic task detection from chat messages.
 * Scans for task-like language patterns and creates task records.
 * AI classification runs afterward to refine confidence and add context.
 */

// Patterns that indicate someone is assigning a task TO the user
const ASSIGNED_TO_ME_PATTERNS = [
  /can you (?:please |kindly )?(?:handle|take care of|look into|check on|follow up|review|update|fix|send|set up|configure|create|schedule)/i,
  /(?:please|pls|plz) (?:handle|take care of|look into|check on|follow up|review|update|fix|send|set up|configure|create|schedule)/i,
  /(?:could|would) you (?:please )?(?:handle|take care of|look into|check|send|set up|update|fix|create)/i,
  /i need you to/i,
  /(?:can|could) you get (?:this|that|it) (?:done|taken care of|handled)/i,
  /(?:are|were) you able to/i,
  /when (?:can|will) you (?:have|get|send|finish)/i,
  /(?:your|you're) (?:responsible for|in charge of|handling)/i,
  /(?:assigning|assigned) (?:this |it )?to you/i,
];

// Patterns that indicate the user is assigning a task to someone else
const ASSIGNED_BY_ME_PATTERNS = [
  /can you (?:please |kindly )?(?:handle|take care of|look into|check on|follow up|review|update|fix|send|set up|configure|create|schedule)/i,
  /(?:please|pls|plz) (?:handle|take care of|look into|check on|follow up|review|update|fix|send|set up|configure|create|schedule)/i,
  /i need (?:you|someone|the team) to/i,
  /(?:can|could) you get (?:this|that|it) done/i,
  /(?:let|have) (?:\w+ )?(?:handle|take care of|look into)/i,
  /(?:please|pls) (?:make sure|ensure)/i,
];

// Patterns indicating a self-commitment
const COMMITMENT_PATTERNS = [
  /i(?:'ll| will) (?:get back|send|check|look into|follow up|take care|handle|update|schedule|have (?:it|this|that) done)/i,
  /let me (?:check|look into|follow up|get back|handle|take care)/i,
  /i(?:'ll| will) (?:do|finish|complete) (?:it|this|that)/i,
  /by (?:end of day|eod|tomorrow|monday|tuesday|wednesday|thursday|friday|next week)/i,
  /i(?:'m going to| am going to) (?:send|check|look|handle|follow)/i,
];

export class TaskDetectionService {
  /**
   * Scan all recent unprocessed messages for task patterns.
   * Returns count of new tasks detected.
   */
  async detectTasks(userId: string): Promise<number> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const userEmail = normalizeEmail(user.email);

    // Get messages not yet linked to a task, from the last 14 days
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const messages = await prisma.chatMessage.findMany({
      where: {
        hasTask: false,
        receivedAt: { gte: fourteenDaysAgo },
        chat: { userId },
      },
      include: { chat: true },
      orderBy: { receivedAt: 'desc' },
    });

    let tasksCreated = 0;

    for (const msg of messages) {
      const content = msg.content;
      if (content.length < 10) continue; // skip very short messages

      let direction: TaskDirection | null = null;
      let matchedPattern: string | null = null;

      if (msg.isFromMe) {
        // Check if I'm assigning to someone else
        for (const pattern of ASSIGNED_BY_ME_PATTERNS) {
          const match = content.match(pattern);
          if (match) {
            direction = 'ASSIGNED_BY_ME';
            matchedPattern = match[0];
            break;
          }
        }

        // Check if I'm making a commitment
        if (!direction) {
          for (const pattern of COMMITMENT_PATTERNS) {
            const match = content.match(pattern);
            if (match) {
              direction = 'COMMITMENT';
              matchedPattern = match[0];
              break;
            }
          }
        }
      } else {
        // Check if someone is assigning to me
        for (const pattern of ASSIGNED_TO_ME_PATTERNS) {
          const match = content.match(pattern);
          if (match) {
            direction = 'ASSIGNED_TO_ME';
            matchedPattern = match[0];
            break;
          }
        }
      }

      if (direction && matchedPattern) {
        // Extract a title from the message (first sentence or up to 100 chars)
        const title = extractTitle(content);

        // Determine who is assigned
        let assignedTo: string | null = null;
        let assignedToName: string | null = null;
        let assignedBy: string | null = null;
        let assignedByName: string | null = null;

        if (direction === 'ASSIGNED_TO_ME') {
          assignedTo = userEmail;
          assignedToName = user.displayName;
          assignedBy = msg.senderEmail;
          assignedByName = msg.senderName;
        } else if (direction === 'ASSIGNED_BY_ME') {
          assignedBy = userEmail;
          assignedByName = user.displayName;
          // Try to determine assignee from mentions or chat participant
          if (msg.mentions.length > 0) {
            assignedTo = msg.mentions[0];
          }
        } else if (direction === 'COMMITMENT') {
          assignedTo = userEmail;
          assignedToName = user.displayName;
          assignedBy = userEmail;
          assignedByName = user.displayName;
        }

        // Check for deadline mentions
        const dueDate = extractDueDate(content);

        await prisma.task.create({
          data: {
            chatId: msg.chat.id,
            direction,
            title,
            context: content,
            assignedTo,
            assignedToName,
            assignedBy,
            assignedByName,
            sourceMessageId: msg.id,
            dueDate,
            aiConfidence: 0, // will be refined by AI
            userId,
          },
        });

        await prisma.chatMessage.update({
          where: { id: msg.id },
          data: { hasTask: true },
        });

        tasksCreated++;
      }
    }

    return tasksCreated;
  }

  /**
   * Check if detected tasks have been completed based on follow-up messages.
   */
  async detectCompletions(userId: string): Promise<number> {
    const openTasks = await prisma.task.findMany({
      where: {
        userId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      include: {
        chat: {
          include: {
            messages: { orderBy: { receivedAt: 'desc' }, take: 20 },
          },
        },
      },
    });

    let completions = 0;
    const completionPatterns = [
      /(?:done|completed|finished|taken care of|handled|resolved|fixed|sent|updated|scheduled)/i,
      /(?:all set|good to go|wrapped up|closed out)/i,
    ];

    for (const task of openTasks) {
      // Look for completion language in messages AFTER the task was detected
      const laterMessages = task.chat.messages.filter(
        m => m.receivedAt > task.detectedAt
      );

      for (const msg of laterMessages) {
        const isRelevantSender =
          (task.direction === 'ASSIGNED_TO_ME' && msg.isFromMe) ||
          (task.direction === 'ASSIGNED_BY_ME' && !msg.isFromMe) ||
          (task.direction === 'COMMITMENT' && msg.isFromMe);

        if (isRelevantSender) {
          for (const pattern of completionPatterns) {
            if (pattern.test(msg.content)) {
              // Mark as potentially completed (AI will confirm)
              completions++;
              break;
            }
          }
        }
      }
    }

    return completions;
  }
}

function extractTitle(content: string): string {
  // Take the first meaningful sentence, up to 120 chars
  const firstLine = content.split(/[.\n!?]/)[0]?.trim() ?? content;
  if (firstLine.length > 120) return firstLine.slice(0, 117) + '...';
  return firstLine;
}

function extractDueDate(content: string): Date | null {
  const lower = content.toLowerCase();
  const now = new Date();

  if (lower.includes('by end of day') || lower.includes('by eod') || lower.includes('today')) {
    const eod = new Date(now);
    eod.setHours(17, 0, 0, 0);
    return eod;
  }
  if (lower.includes('by tomorrow') || lower.includes('tomorrow')) {
    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    tom.setHours(17, 0, 0, 0);
    return tom;
  }
  if (lower.includes('by next week') || lower.includes('next week')) {
    const nw = new Date(now);
    nw.setDate(nw.getDate() + (8 - nw.getDay())); // next Monday
    nw.setHours(9, 0, 0, 0);
    return nw;
  }

  // Day name matching
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (lower.includes(`by ${days[i]}`) || lower.includes(`on ${days[i]}`)) {
      const target = new Date(now);
      const diff = (i - target.getDay() + 7) % 7 || 7;
      target.setDate(target.getDate() + diff);
      target.setHours(17, 0, 0, 0);
      return target;
    }
  }

  return null;
}

export const taskDetectionService = new TaskDetectionService();
