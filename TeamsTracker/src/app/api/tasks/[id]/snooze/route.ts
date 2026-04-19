import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const hours = body.hours ?? 24;
    const until = new Date(Date.now() + hours * 60 * 60 * 1000);
    await prisma.task.update({ where: { id }, data: { status: 'SNOOZED', snoozedUntil: until } });
    return NextResponse.json({ ok: true, snoozedUntil: until.toISOString() });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
