import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { syncService } from '@/services/sync.service';
import { taskDetectionService } from '@/services/task-detection.service';
import { aiService } from '@/services/ai.service';

export async function POST() {
  try {
    const session = await requireAuth();
    const syncResult = await syncService.syncChats(session.userId!);
    const tasksDetected = await taskDetectionService.detectTasks(session.userId!);
    const completions = await taskDetectionService.detectCompletions(session.userId!);

    let aiClassified = 0;
    if (process.env.OPENAI_API_KEY) {
      try { aiClassified = await aiService.classifyNewTasks(session.userId!); } catch {}
    }

    return NextResponse.json({ ...syncResult, tasksDetected, completions, aiClassified });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    return NextResponse.json({ error: 'Sync failed', details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
