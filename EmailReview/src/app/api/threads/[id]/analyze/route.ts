import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isMockMode } from '@/lib/auth';
import { aiService } from '@/services/ai.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (isMockMode()) {
    return NextResponse.json({
      summary: 'Mock AI analysis — enable live mode with OPENAI_API_KEY for real results.',
      classification: 'needs_action',
      priority: 'high',
      suggestedAction: 'Review thread and respond to client.',
      explanation: 'This is mock data for development.',
      mock: true,
    });
  }

  try {
    await requireAuth();
    await aiService.analyzeThread(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'AI analysis failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
