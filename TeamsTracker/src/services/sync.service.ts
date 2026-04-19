import prisma from '@/lib/prisma';
import { graphTeamsService } from './graph.service';
import { htmlToText, normalizeEmail, toJson } from '@/lib/utils';

/**
 * SyncService ingests Teams chat messages into the local database.
 */
export class SyncService {
  async syncChats(userId: string): Promise<{ chatsProcessed: number; messagesProcessed: number; errors: string[] }> {
    const result = { chatsProcessed: 0, messagesProcessed: 0, errors: [] as string[] };

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const userEmail = normalizeEmail(user.email);

    await prisma.auditLog.create({
      data: { action: 'sync_started', userId, details: toJson({ type: 'teams' }) },
    });

    let graphChats;
    try {
      graphChats = await graphTeamsService.getChats(userId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Chat list fetch failed: ${msg}`);
      return result;
    }

    // Only sync chats with recent activity (last 14 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);

    for (const gc of graphChats) {
      if (new Date(gc.lastUpdatedDateTime) < cutoff) continue;

      try {
        // Upsert chat
        const chat = await prisma.chat.upsert({
          where: { graphChatId: gc.id },
          update: {
            chatType: gc.chatType,
            topic: gc.topic,
            lastMessageAt: new Date(gc.lastUpdatedDateTime),
            lastSyncedAt: new Date(),
          },
          create: {
            graphChatId: gc.id,
            chatType: gc.chatType,
            topic: gc.topic,
            lastMessageAt: new Date(gc.lastUpdatedDateTime),
            lastSyncedAt: new Date(),
            userId,
          },
        });

        // Fetch messages for this chat
        const messages = await graphTeamsService.getChatMessages(userId, gc.id, 14);

        for (const msg of messages) {
          if (!msg.from?.user) continue;

          const senderEmail = normalizeEmail(msg.from.user.userPrincipalName ?? msg.from.user.displayName);
          const senderName = msg.from.user.displayName;
          const content = htmlToText(msg.body.content);

          if (!content.trim()) continue;

          const mentions = (msg.mentions ?? [])
            .map(m => normalizeEmail(m.mentioned.user?.userPrincipalName ?? ''))
            .filter(Boolean);

          await prisma.chatMessage.upsert({
            where: { graphMessageId: msg.id },
            update: {
              content,
              importance: msg.importance,
            },
            create: {
              graphMessageId: msg.id,
              chatId: chat.id,
              senderEmail,
              senderName,
              content,
              receivedAt: new Date(msg.createdDateTime),
              isFromMe: senderEmail === userEmail,
              importance: msg.importance,
              mentions,
            },
          });

          result.messagesProcessed++;
        }

        result.chatsProcessed++;
      } catch (err) {
        result.errors.push(`Chat ${gc.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await prisma.user.update({ where: { id: userId }, data: { lastSyncAt: new Date() } });

    await prisma.auditLog.create({
      data: { action: 'sync_completed', userId, details: toJson(result) },
    });

    return result;
  }
}

export const syncService = new SyncService();
