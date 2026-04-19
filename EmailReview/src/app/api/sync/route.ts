import { NextResponse } from 'next/server';
import { requireAuth, isMockMode } from '@/lib/auth';
import { syncService } from '@/services/sync.service';
import { threadAnalysisService } from '@/services/thread-analysis.service';
import { categoryService } from '@/services/category.service';

export async function POST() {
  if (isMockMode()) {
    return NextResponse.json({
      messagesProcessed: 47,
      threadsUpdated: 12,
      flagsGenerated: 8,
      aiAnalyzed: 5,
      delegationsFound: 3,
      ticketsMatched: 2,
      errors: [],
      mock: true,
    });
  }

  try {
    const session = await requireAuth();
    const syncResult = await syncService.syncMailbox(session.userId!);

    // Run full V2 analysis pipeline (delegation → tickets → rules → AI)
    const analysisResult = await threadAnalysisService.runFullAnalysis(session.userId!, true);

    // Auto-categorize flagged messages in Outlook
    let categorized = 0;
    try {
      categorized = await categoryService.autoCategorize(session.userId!);
    } catch (err) {
      console.error('Auto-categorize failed:', err);
    }

    return NextResponse.json({
      ...syncResult,
      ...analysisResult,
      categorized,
    });
  } catch (err) {
    console.error('Sync failed:', err);
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Sync failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
