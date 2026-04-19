import { NextResponse } from 'next/server';
import { requireAuth, isMockMode } from '@/lib/auth';
import { digestService } from '@/services/digest.service';
import { MOCK_DIGEST } from '@/mock/data';

/** Generate a new digest. */
export async function POST() {
  if (isMockMode()) {
    return NextResponse.json({
      id: 'mock-digest-001',
      content: MOCK_DIGEST,
      plainText: renderMockPlainText(MOCK_DIGEST),
      mock: true,
    });
  }

  try {
    const session = await requireAuth();
    const result = await digestService.generateDigest(session.userId!);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Digest generation failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/** Get digest history. */
export async function GET() {
  if (isMockMode()) {
    return NextResponse.json({
      digests: [
        {
          id: 'mock-digest-001',
          generatedAt: new Date().toISOString(),
          itemCount: 8,
          status: 'GENERATED',
        },
      ],
    });
  }

  try {
    const session = await requireAuth();
    const digests = await digestService.getDigestHistory(session.userId!);
    return NextResponse.json({ digests });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to load digests' }, { status: 500 });
  }
}

function renderMockPlainText(digest: typeof MOCK_DIGEST): string {
  const lines = ['EXECUTIVE EMAIL DIGEST (Mock Mode)', '='.repeat(50), ''];
  lines.push(`Total Flagged: ${digest.stats.totalFlagged}`);
  lines.push('');
  for (const item of digest.items) {
    lines.push(`- [${item.urgency.toUpperCase()}] ${item.subject}`);
    lines.push(`  ${item.companyName ?? 'Unknown'} | ${item.reasonFlagged}`);
    lines.push(`  Action: ${item.recommendedAction}`);
    lines.push('');
  }
  return lines.join('\n');
}
