import { ConfidentialClientApplication, Configuration, AuthorizationUrlRequest } from '@azure/msal-node';
import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';

const msalConfig: Configuration = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
  },
};

let msalInstance: ConfidentialClientApplication | null = null;

export function getMsalClient(): ConfidentialClientApplication {
  if (!msalInstance) {
    msalInstance = new ConfidentialClientApplication(msalConfig);
  }
  return msalInstance;
}

export const GRAPH_SCOPES = [
  'User.Read',
  'Chat.Read',
  'offline_access',
];

export async function getAuthUrl(): Promise<string> {
  const client = getMsalClient();
  const request: AuthorizationUrlRequest = {
    scopes: GRAPH_SCOPES,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/teams/api/auth/callback/`,
  };
  return client.getAuthCodeUrl(request);
}

export interface SessionData {
  userId?: string;
  email?: string;
  displayName?: string;
  isLoggedIn?: boolean;
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, {
    password: process.env.SESSION_SECRET!,
    cookieName: 'ttt_session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
    },
  });
}

export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    throw new Error('Unauthorized');
  }
  return session;
}

export function isMockMode(): boolean {
  return process.env.MOCK_MODE === 'true';
}
