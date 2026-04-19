import { Client } from '@microsoft/microsoft-graph-client';
import { getMsalClient, GRAPH_SCOPES } from '@/lib/auth';
import prisma from '@/lib/prisma';

interface GraphChat {
  id: string;
  chatType: string;
  topic: string | null;
  lastUpdatedDateTime: string;
}

interface GraphChatMessage {
  id: string;
  messageType: string;
  createdDateTime: string;
  from: {
    user?: { id: string; displayName: string; userPrincipalName?: string };
  } | null;
  body: { contentType: string; content: string };
  importance: string;
  mentions?: Array<{ id: number; mentionText: string; mentioned: { user?: { id: string; displayName: string; userPrincipalName?: string } } }>;
}

export class GraphTeamsService {
  private async getClient(userId: string): Promise<Client> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!user.graphAccessToken) {
      throw new Error('No Graph access token. User must re-authenticate.');
    }

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

  /** List all chats for the user, sorted by last activity. */
  async getChats(userId: string): Promise<GraphChat[]> {
    const client = await this.getClient(userId);
    const chats: GraphChat[] = [];

    let url = '/me/chats?$top=50';
    while (url) {
      const response = await client.api(url).get();
      chats.push(...(response.value ?? []));
      url = response['@odata.nextLink'] ?? '';
      // Limit to 200 chats max
      if (chats.length >= 200) break;
    }

    return chats;
  }

  /**
   * Get messages from a specific chat.
   * Returns messages from the last N days.
   */
  async getChatMessages(userId: string, graphChatId: string, days: number): Promise<GraphChatMessage[]> {
    const client = await this.getClient(userId);
    const since = new Date();
    since.setDate(since.getDate() - days);
    // Hard floor: 2026-03-01
    const floor = new Date('2026-03-01T00:00:00Z');
    const effectiveSince = since > floor ? since : floor;

    const messages: GraphChatMessage[] = [];

    let url =
      `/me/chats/${graphChatId}/messages` +
      `?$top=50&$orderby=createdDateTime desc`;

    while (url) {
      const response = await client.api(url).get();
      const batch: GraphChatMessage[] = response.value ?? [];

      for (const msg of batch) {
        // Skip system messages
        if (msg.messageType !== 'message') continue;
        // Stop if message is older than our window
        if (new Date(msg.createdDateTime) < effectiveSince) {
          return messages;
        }
        messages.push(msg);
      }

      url = response['@odata.nextLink'] ?? '';
      if (messages.length >= 500) break;
    }

    return messages;
  }

  /** Get the authenticated user's profile. */
  async getMe(userId: string) {
    const client = await this.getClient(userId);
    return client.api('/me').select('id,displayName,mail,userPrincipalName').get();
  }
}

export const graphTeamsService = new GraphTeamsService();
