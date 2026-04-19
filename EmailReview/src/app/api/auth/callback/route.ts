import { NextRequest, NextResponse } from 'next/server';
import { getMsalClient, GRAPH_SCOPES, getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Client } from '@microsoft/microsoft-graph-client';
import type { GraphUser } from '@/types/graph';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  try {
    const msalClient = getMsalClient();
    const result = await msalClient.acquireTokenByCode({
      code,
      scopes: GRAPH_SCOPES,
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/eer/api/auth/callback/`,
    });

    if (!result) {
      return NextResponse.json({ error: 'Token acquisition failed' }, { status: 500 });
    }

    // Extract refresh token from MSAL's internal cache
    let refreshToken: string | null = null;
    try {
      const cacheData = JSON.parse(msalClient.getTokenCache().serialize());
      const rtKeys = Object.keys(cacheData.RefreshToken || {});
      if (rtKeys.length > 0) {
        refreshToken = cacheData.RefreshToken[rtKeys[0]].secret;
      }
    } catch {
      console.warn('Could not extract refresh token from MSAL cache');
    }

    // Get user profile from Graph
    const graphClient = Client.init({
      authProvider: (done) => done(null, result.accessToken),
    });
    const profile: GraphUser = await graphClient
      .api('/me')
      .select('id,displayName,mail,userPrincipalName')
      .get();

    const email = (profile.mail ?? profile.userPrincipalName).toLowerCase();

    // Upsert user in database
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        displayName: profile.displayName,
        graphAccessToken: result.accessToken,
        graphRefreshToken: refreshToken,
        tokenExpiresAt: result.expiresOn ?? null,
      },
      create: {
        email,
        displayName: profile.displayName,
        graphAccessToken: result.accessToken,
        graphRefreshToken: refreshToken,
        tokenExpiresAt: result.expiresOn ?? null,
      },
    });

    // Create session
    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.displayName = user.displayName;
    session.isLoggedIn = true;
    await session.save();

    await prisma.auditLog.create({
      data: { action: 'user_login', userId: user.id, details: JSON.parse(JSON.stringify({ email, hasRefreshToken: !!refreshToken })) },
    });

    return NextResponse.redirect(new URL('/eer/dashboard', process.env.NEXT_PUBLIC_APP_URL!));
  } catch (err) {
    console.error('Auth callback error:', err);
    return NextResponse.json(
      { error: 'Authentication failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
