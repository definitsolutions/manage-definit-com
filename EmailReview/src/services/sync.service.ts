import prisma from '@/lib/prisma';
import { graphService } from './graph.service';
import { configService } from './config.service';
import { extractDomain, normalizeEmail, toJson } from '@/lib/utils';
import type { GraphMessage } from '@/types/graph';
import type { SyncResult } from '@/types';
import type { MessageDirection } from '@prisma/client';

/**
 * SyncService ingests mail from Microsoft Graph into the local database.
 * It uses stable Graph message IDs to avoid duplicates on re-sync.
 */
export class SyncService {
  /**
   * Full sync: pull inbox + sent items, upsert messages, rebuild threads.
   */
  async syncMailbox(userId: string): Promise<SyncResult> {
    const config = await configService.getConfig();
    const result: SyncResult = { messagesProcessed: 0, threadsUpdated: 0, flagsGenerated: 0, errors: [] };

    await prisma.auditLog.create({
      data: { action: 'sync_started', userId, details: toJson({ days: config.syncDays }) },
    });

    // Fetch user info to determine internal domain
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const userDomain = extractDomain(user.email);

    // Load identification lists
    const clientDomains = await prisma.clientDomain.findMany({ where: { isActive: true } });
    const clientDomainSet = new Set(clientDomains.map((d) => d.domain));
    const ignoredDomains = await prisma.ignoredDomain.findMany();
    const ignoredDomainSet = new Set(ignoredDomains.map((d) => d.domain));
    const vipContacts = await prisma.vipContact.findMany({ where: { isActive: true } });
    const vipEmailSet = new Set(vipContacts.map((v) => v.email));

    // Fetch messages from Graph
    let inboxMessages: GraphMessage[] = [];
    let sentMessages: GraphMessage[] = [];

    try {
      inboxMessages = await graphService.getMessages(userId, 'inbox', config.syncDays);
    } catch (err) {
      result.errors.push(`Inbox fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      sentMessages = await graphService.getMessages(userId, 'sentitems', config.syncDays);
    } catch (err) {
      result.errors.push(`Sent fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Process all messages
    const conversationIds = new Set<string>();

    for (const msg of inboxMessages) {
      try {
        await this.upsertMessage(msg, userId, 'INBOUND', userDomain, clientDomainSet, ignoredDomainSet, vipEmailSet);
        conversationIds.add(msg.conversationId);
        result.messagesProcessed++;
      } catch (err) {
        result.errors.push(`Message ${msg.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    for (const msg of sentMessages) {
      try {
        await this.upsertMessage(msg, userId, 'OUTBOUND', userDomain, clientDomainSet, ignoredDomainSet, vipEmailSet);
        conversationIds.add(msg.conversationId);
        result.messagesProcessed++;
      } catch (err) {
        result.errors.push(`Message ${msg.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Rebuild threads for affected conversations
    for (const convId of conversationIds) {
      try {
        await this.rebuildThread(convId, userId, clientDomainSet);
        result.threadsUpdated++;
      } catch (err) {
        result.errors.push(`Thread ${convId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Update user's last sync time
    await prisma.user.update({ where: { id: userId }, data: { lastSyncAt: new Date() } });

    await prisma.auditLog.create({
      data: { action: 'sync_completed', userId, details: toJson(result) },
    });

    return result;
  }

  /**
   * Upsert a single message from Graph into the database.
   */
  private async upsertMessage(
    msg: GraphMessage,
    userId: string,
    direction: MessageDirection,
    userDomain: string,
    clientDomains: Set<string>,
    ignoredDomains: Set<string>,
    vipEmails: Set<string>,
  ): Promise<void> {
    const senderEmail = normalizeEmail(msg.from.emailAddress.address);
    const senderDomain = extractDomain(senderEmail);
    const recipientEmails = msg.toRecipients.map((r) => normalizeEmail(r.emailAddress.address));
    const ccEmails = (msg.ccRecipients ?? []).map((r) => normalizeEmail(r.emailAddress.address));

    // Skip ignored domains
    if (ignoredDomains.has(senderDomain)) return;

    const isExternal = senderDomain !== userDomain;
    const isClientRelated =
      clientDomains.has(senderDomain) ||
      vipEmails.has(senderEmail) ||
      recipientEmails.some((e) => clientDomains.has(extractDomain(e))) ||
      recipientEmails.some((e) => vipEmails.has(e));

    await prisma.message.upsert({
      where: { graphMessageId: msg.id },
      update: {
        isRead: msg.isRead,
        categories: msg.categories,
        bodyPreview: msg.bodyPreview ?? '',
        importance: msg.importance,
        isClientRelated,
      },
      create: {
        graphMessageId: msg.id,
        conversationId: msg.conversationId,
        internetMessageId: msg.internetMessageId,
        subject: msg.subject ?? '(No subject)',
        senderName: msg.from.emailAddress.name ?? null,
        senderEmail,
        recipientEmails,
        ccEmails,
        receivedAt: new Date(msg.receivedDateTime),
        sentAt: msg.sentDateTime ? new Date(msg.sentDateTime) : null,
        isRead: msg.isRead,
        categories: msg.categories,
        bodyPreview: msg.bodyPreview ?? '',
        direction,
        isExternal,
        isClientRelated,
        folderId: msg.parentFolderId,
        importance: msg.importance,
        hasAttachments: msg.hasAttachments,
        userId,
      },
    });
  }

  /**
   * Rebuild thread aggregate from its messages.
   */
  private async rebuildThread(
    conversationId: string,
    userId: string,
    clientDomains: Set<string>,
  ): Promise<void> {
    const messages = await prisma.message.findMany({
      where: { conversationId, userId },
      orderBy: { receivedAt: 'asc' },
    });

    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    const subject = messages[0].subject;
    const lastMessageAt = lastMessage.receivedAt;

    // Find last client message and last internal message
    let lastClientMessageAt: Date | null = null;
    let lastInternalMessageAt: Date | null = null;
    let clientCount = 0;
    let internalCount = 0;

    for (const m of messages) {
      if (m.isExternal && m.isClientRelated) {
        lastClientMessageAt = m.receivedAt;
        clientCount++;
      } else if (!m.isExternal) {
        lastInternalMessageAt = m.receivedAt;
        internalCount++;
      }
    }

    const lastSenderDomain = extractDomain(lastMessage.senderEmail);
    const lastSenderIsClient = clientDomains.has(lastSenderDomain);

    const thread = await prisma.thread.upsert({
      where: { conversationId },
      update: {
        subject,
        lastMessageAt,
        lastClientMessageAt,
        lastInternalMessageAt,
        messageCount: messages.length,
        clientMessageCount: clientCount,
        internalMessageCount: internalCount,
        lastSenderEmail: lastMessage.senderEmail,
        lastSenderIsClient,
      },
      create: {
        conversationId,
        subject,
        lastMessageAt,
        lastClientMessageAt,
        lastInternalMessageAt,
        messageCount: messages.length,
        clientMessageCount: clientCount,
        internalMessageCount: internalCount,
        lastSenderEmail: lastMessage.senderEmail,
        lastSenderIsClient,
        userId,
      },
    });

    // Link messages to thread
    await prisma.message.updateMany({
      where: { conversationId, userId },
      data: { threadId: thread.id },
    });
  }
}

export const syncService = new SyncService();
