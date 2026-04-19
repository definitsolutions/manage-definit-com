import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isMockMode } from '@/lib/auth';
import { categoryService } from '@/services/category.service';

/** Get app-defined Outlook categories. */
export async function GET() {
  const categories = categoryService.getAppCategories();
  return NextResponse.json({ categories });
}

/** Sync categories to Outlook or apply a category to a message. */
export async function POST(req: NextRequest) {
  if (isMockMode()) {
    return NextResponse.json({ ok: true, mock: true });
  }

  try {
    const session = await requireAuth();
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'sync':
        await categoryService.ensureDefaultCategories(session.userId!);
        break;
      case 'apply':
        await categoryService.categorizeMessage(session.userId!, body.graphMessageId, body.category);
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Category operation failed' }, { status: 500 });
  }
}
