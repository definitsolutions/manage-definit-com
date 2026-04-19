import { graphService } from './graph.service';
import prisma from '@/lib/prisma';
import { isMockMode } from '@/lib/auth';
import type { FlagType } from '@prisma/client';

const DEFAULT_CATEGORIES = [
  { displayName: 'EER: Needs Reply', color: 'red' },
  { displayName: 'EER: VIP', color: 'orange' },
  { displayName: 'EER: Reviewed', color: 'green' },
  { displayName: 'EER: Stale', color: 'yellow' },
  { displayName: 'EER: Promise Made', color: 'purple' },
  { displayName: 'EER: Has Ticket', color: 'blue' },
];

const FLAG_TO_CATEGORY: Partial<Record<FlagType, string>> = {
  CLIENT_AWAITING_REPLY: 'EER: Needs Reply',
  NO_INTERNAL_REPLY: 'EER: Needs Reply',
  VIP_NEEDS_ATTENTION: 'EER: VIP',
  STALE_THREAD: 'EER: Stale',
  COMMITMENT_NO_FOLLOWUP: 'EER: Promise Made',
};

export class CategoryService {
  async ensureDefaultCategories(userId: string): Promise<void> {
    if (isMockMode()) return;
    for (const cat of DEFAULT_CATEGORIES) {
      await graphService.ensureCategory(userId, cat.displayName, cat.color);
    }
  }

  async categorizeMessage(userId: string, graphMessageId: string, category: string): Promise<void> {
    if (isMockMode()) return;
    await graphService.categorizeMessage(userId, graphMessageId, category);
  }

  /**
   * V2: Auto-categorize flagged messages in Outlook based on their thread flags.
   * Called after the rules engine runs.
   */
  async autoCategorize(userId: string): Promise<number> {
    if (isMockMode()) return 0;

    // Ensure categories exist first
    await this.ensureDefaultCategories(userId);

    // Get all threads with unresolved flags
    const threads = await prisma.thread.findMany({
      where: {
        userId,
        status: { in: ['OPEN', 'REVIEWED'] },
        flags: { some: { isResolved: false } },
      },
      include: {
        flags: { where: { isResolved: false } },
        messages: {
          where: { isExternal: true, isClientRelated: true },
          orderBy: { receivedAt: 'desc' },
          take: 1, // only categorize the latest client message
        },
      },
    });

    let categorized = 0;

    for (const thread of threads) {
      const msg = thread.messages[0];
      if (!msg) continue;

      // Determine the most relevant category from flags
      for (const flag of thread.flags) {
        const category = FLAG_TO_CATEGORY[flag.flagType];
        if (category) {
          try {
            await graphService.categorizeMessage(userId, msg.graphMessageId, category);
            categorized++;
          } catch {
            // Non-fatal — message may have been moved/deleted
          }
          break; // one category per message
        }
      }

      // If thread has a ticket, add the ticket category
      if (thread.hasTicket) {
        try {
          await graphService.categorizeMessage(userId, msg.graphMessageId, 'EER: Has Ticket');
        } catch {
          // Non-fatal
        }
      }
    }

    return categorized;
  }

  getAppCategories() {
    return DEFAULT_CATEGORIES;
  }
}

export const categoryService = new CategoryService();
