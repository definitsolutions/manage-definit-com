import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isMockMode } from '@/lib/auth';
import { aiService } from '@/services/ai.service';
import { MOCK_THREAD_DETAIL } from '@/mock/data';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isMockMode()) {
    return NextResponse.json({
      draft: MOCK_THREAD_DETAIL.aiAnalysis?.draftReply ??
        'Hi,\n\nThank you for reaching out. I\'m looking into this now and will follow up shortly.\n\nBest regards',
      mock: true,
    });
  }

  try {
    await requireAuth();
    const draft = await aiService.generateDraftReply(id);
    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Draft generation failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
