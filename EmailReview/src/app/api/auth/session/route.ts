import { NextResponse } from 'next/server';
import { getSession, isMockMode } from '@/lib/auth';
import { MOCK_USER } from '@/mock/data';

export async function GET() {
  if (isMockMode()) {
    return NextResponse.json(MOCK_USER);
  }

  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ isLoggedIn: false }, { status: 401 });
  }

  return NextResponse.json({
    id: session.userId,
    email: session.email,
    displayName: session.displayName,
    isLoggedIn: true,
  });
}

export async function DELETE() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
