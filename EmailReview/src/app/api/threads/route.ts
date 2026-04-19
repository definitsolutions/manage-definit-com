import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isMockMode } from '@/lib/auth';
import { threadAnalysisService } from '@/services/thread-analysis.service';
import { MOCK_THREADS, MOCK_STATS } from '@/mock/data';
import type { ThreadFilter } from '@/types';

export async function GET(req: NextRequest) {
  const filter = (req.nextUrl.searchParams.get('filter') ?? 'flagged') as ThreadFilter;
  const status = req.nextUrl.searchParams.get('status') ?? undefined;

  if (isMockMode()) {
    return NextResponse.json({
      threads: MOCK_THREADS,
      stats: MOCK_STATS,
    });
  }

  try {
    const session = await requireAuth();
    const [threads, stats] = await Promise.all([
      threadAnalysisService.getThreadList(session.userId!, filter, status),
      threadAnalysisService.getDashboardStats(session.userId!),
    ]);

    return NextResponse.json({ threads, stats });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load threads' }, { status: 500 });
  }
}
