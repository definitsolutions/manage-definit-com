import { ConfidentialClientApplication, Configuration, AuthorizationUrlRequest } from '@azure/msal-node';
import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';

// ── MSAL Configuration ──────────────────────────────────────

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

// ── Graph Scopes ────────────────────────────────────────────

export const GRAPH_SCOPES = [
  'User.Read',
  'Mail.Read',
  'Mail.ReadWrite',
  'offline_access',
];

// ── Auth URL ────────────────────────────────────────────────

export async function getAuthUrl(): Promise<string> {
  const client = getMsalClient();
  const request: AuthorizationUrlRequest = {
    scopes: GRAPH_SCOPES,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/eer/api/auth/callback/`,
  };
  return client.getAuthCodeUrl(request);
}

// ── Session ─────────────────────────────────────────────────

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
    cookieName: 'eer_session',
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

// ── Mock mode helper ────────────────────────────────────────

export function isMockMode(): boolean {
  return process.env.MOCK_MODE === 'true';
}
