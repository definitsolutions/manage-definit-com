import { NextResponse } from 'next/server';
import { getAuthUrl, isMockMode, getSession } from '@/lib/auth';

export async function GET() {
  if (isMockMode()) {
    const session = await getSession();
    session.userId = 'mock-user-001';
    session.email = 'r.mcnicholas@definit.com';
    session.displayName = 'Robert McNicholas';
    session.isLoggedIn = true;
    await session.save();
    return NextResponse.redirect(new URL('/teams/dashboard/', process.env.NEXT_PUBLIC_APP_URL!));
  }
  const url = await getAuthUrl();
  return NextResponse.redirect(url);
}
