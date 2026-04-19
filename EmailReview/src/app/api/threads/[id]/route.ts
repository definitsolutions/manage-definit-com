import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isMockMode } from '@/lib/auth';
import { threadAnalysisService } from '@/services/thread-analysis.service';
import { MOCK_THREAD_DETAIL, MOCK_THREADS } from '@/mock/data';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isMockMode()) {
    // Return the full detail for thread-001, or a basic view for others
    if (id === 'thread-001') {
      return NextResponse.json(MOCK_THREAD_DETAIL);
    }
    const thread = MOCK_THREADS.find((t) => t.id === id);
    if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ...thread, messages: [], aiAnalysis: null, reviewNote: null, reviewedAt: null });
  }

  try {
    await requireAuth();
    const detail = await threadAnalysisService.getThreadDetail(id);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(detail);
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load thread' }, { status: 500 });
  }
}

/** Update thread status (review / dismiss / reopen). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isMockMode()) {
    return NextResponse.json({ ok: true, mock: true });
  }

  try {
    await requireAuth();
    const body = await req.json();
    const { action, note } = body as { action: 'review' | 'dismiss' | 'reopen'; note?: string };

    switch (action) {
      case 'review':
        await threadAnalysisService.reviewThread(id, note);
        break;
      case 'dismiss':
        await threadAnalysisService.dismissThread(id, note);
        break;
      case 'reopen':
        await threadAnalysisService.reopenThread(id);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update thread' }, { status: 500 });
  }
}
