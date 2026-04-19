import { NextRequest, NextResponse } from 'next/server';
import { getMsalClient, GRAPH_SCOPES, getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Client } from '@microsoft/microsoft-graph-client';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

  try {
    const msalClient = getMsalClient();
    const result = await msalClient.acquireTokenByCode({
      code,
      scopes: GRAPH_SCOPES,
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/teams/api/auth/callback/`,
    });
    if (!result) return NextResponse.json({ error: 'Token failed' }, { status: 500 });

    let refreshToken: string | null = null;
    try {
      const cacheData = JSON.parse(msalClient.getTokenCache().serialize());
      const rtKeys = Object.keys(cacheData.RefreshToken || {});
      if (rtKeys.length > 0) refreshToken = cacheData.RefreshToken[rtKeys[0]].secret;
    } catch {}

    const graphClient = Client.init({ authProvider: (done) => done(null, result.accessToken) });
    const profile = await graphClient.api('/me').select('id,displayName,mail,userPrincipalName').get();
    const email = (profile.mail ?? profile.userPrincipalName).toLowerCase();

    const user = await prisma.user.upsert({
      where: { email },
      update: { displayName: profile.displayName, graphAccessToken: result.accessToken, graphRefreshToken: refreshToken, tokenExpiresAt: result.expiresOn ?? null },
      create: { email, displayName: profile.displayName, graphAccessToken: result.accessToken, graphRefreshToken: refreshToken, tokenExpiresAt: result.expiresOn ?? null },
    });

    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.displayName = user.displayName;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.redirect(new URL('/teams/dashboard/', process.env.NEXT_PUBLIC_APP_URL!));
  } catch (err) {
    console.error('Auth callback error:', err);
    return NextResponse.json({ error: 'Auth failed', details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
