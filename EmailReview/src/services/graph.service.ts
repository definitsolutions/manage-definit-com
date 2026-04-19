import { Client } from '@microsoft/microsoft-graph-client';
import { getMsalClient, GRAPH_SCOPES } from '@/lib/auth';
import prisma from '@/lib/prisma';
import type { GraphMessage, GraphMessageListResponse, GraphUser } from '@/types/graph';

/**
 * GraphService wraps Microsoft Graph API calls for mail operations.
 * All methods require a userId whose tokens are stored in the database.
 */
export class GraphService {
  private async getClient(userId: string): Promise<Client> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!user.graphAccessToken) {
      throw new Error('No Graph access token found. User must re-authenticate.');
    }

    // Refresh the token if it's expired or about to expire (5 min buffer)
    let accessToken = user.graphAccessToken;
    const expiresAt = user.tokenExpiresAt ? new Date(user.tokenExpiresAt) : new Date(0);
    const bufferMs = 5 * 60 * 1000;

    if (Date.now() > expiresAt.getTime() - bufferMs && user.graphRefreshToken) {
      const msalClient = getMsalClient();
      const result = await msalClient.acquireTokenByRefreshToken({
        refreshToken: user.graphRefreshToken,
        scopes: GRAPH_SCOPES,
      });

      if (result) {
        accessToken = result.accessToken;
        await prisma.user.update({
          where: { id: userId },
          data: {
            graphAccessToken: result.accessToken,
            tokenExpiresAt: result.expiresOn ?? undefined,
          },
        });
      }
    }

    return Client.init({
      authProvider: (done) => done(null, accessToken),
    });
  }

  /** Fetch the authenticated user's profile. */
  async getMe(userId: string): Promise<GraphUser> {
    const client = await this.getClient(userId);
    return client.api('/me').select('id,displayName,mail,userPrincipalName').get();
  }

  /**
   * Fetch messages from a folder (inbox or sentitems) for the last N days.
   * Handles pagination automatically.
   */
  async getMessages(userId: string, folder: 'inbox' | 'sentitems', days: number): Promise<GraphMessage[]> {
    const client = await this.getClient(userId);
    const since = new Date();
    since.setDate(since.getDate() - days);
    // Hard floor: never pull anything before 2026-03-01
    const floor = new Date('2026-03-01T00:00:00Z');
    const effectiveSince = since > floor ? since : floor;
    const sinceIso = effectiveSince.toISOString();

    const messages: GraphMessage[] = [];
    let url =
      `/me/mailFolders/${folder}/messages` +
      `?$filter=receivedDateTime ge ${sinceIso}` +
      `&$select=id,conversationId,internetMessageId,subject,from,toRecipients,ccRecipients,` +
      `receivedDateTime,sentDateTime,isRead,categories,bodyPreview,importance,hasAttachments,parentFolderId` +
      `&$orderby=receivedDateTime desc` +
      `&$top=100`;

    while (url) {
      const response: GraphMessageListResponse = await client.api(url).get();
      messages.push(...response.value);
      url = response['@odata.nextLink'] ?? '';
    }

    return messages;
  }

  /** Create or update a category on the user's mailbox. */
  async ensureCategory(userId: string, displayName: string, color: string): Promise<void> {
    const client = await this.getClient(userId);
    try {
      // Try to get existing categories
      const existing = await client.api('/me/outlook/masterCategories').get();
      const found = existing.value?.find(
        (c: { displayName: string }) => c.displayName === displayName
      );
      if (!found) {
        await client.api('/me/outlook/masterCategories').post({
          displayName,
          color: mapColor(color),
        });
      }
    } catch {
      // Category may already exist; not critical if this fails
    }
  }

  /** Apply a category label to a message. */
  async categorizeMessage(userId: string, messageId: string, category: string): Promise<void> {
    const client = await this.getClient(userId);
    const msg = await client.api(`/me/messages/${messageId}`).select('categories').get();
    const categories: string[] = msg.categories ?? [];
    if (!categories.includes(category)) {
      categories.push(category);
      await client.api(`/me/messages/${messageId}`).patch({ categories });
    }
  }
}

/**
 * Maps a friendly color name to Graph API preset values.
 * Graph uses preset0 through preset24.
 */
function mapColor(color: string): string {
  const map: Record<string, string> = {
    red: 'preset0',
    orange: 'preset1',
    yellow: 'preset3',
    green: 'preset4',
    blue: 'preset7',
    purple: 'preset8',
    cranberry: 'preset9',
  };
  return map[color.toLowerCase()] ?? 'preset7';
}

export const graphService = new GraphService();
