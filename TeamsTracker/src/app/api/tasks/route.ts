import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const filter = req.nextUrl.searchParams.get('filter') ?? 'open';
    const direction = req.nextUrl.searchParams.get('direction') ?? undefined;

    const where: Record<string, unknown> = { userId: session.userId };

    if (filter === 'open') where.status = { in: ['OPEN', 'IN_PROGRESS'] };
    else if (filter === 'completed') where.status = 'COMPLETED';
    else if (filter === 'snoozed') where.status = 'SNOOZED';
    else if (filter === 'dismissed') where.status = 'DISMISSED';

    if (direction) where.direction = direction;

    // Only show tasks AI confirmed (confidence > 0.3) or not yet classified
    where.OR = [{ aiConfidence: { gte: 0.3 } }, { aiConfidence: 0 }];

    const tasks = await prisma.task.findMany({
      where,
      include: {
        chat: { select: { topic: true, chatType: true } },
      },
      orderBy: [{ priority: 'desc' }, { detectedAt: 'desc' }],
      take: 100,
    });

    // Stats
    const [assignedToMe, assignedByMe, commitments, overdue, completed] = await Promise.all([
      prisma.task.count({ where: { userId: session.userId, direction: 'ASSIGNED_TO_ME', status: { in: ['OPEN', 'IN_PROGRESS'] }, OR: [{ aiConfidence: { gte: 0.3 } }, { aiConfidence: 0 }] } }),
      prisma.task.count({ where: { userId: session.userId, direction: 'ASSIGNED_BY_ME', status: { in: ['OPEN', 'IN_PROGRESS'] }, OR: [{ aiConfidence: { gte: 0.3 } }, { aiConfidence: 0 }] } }),
      prisma.task.count({ where: { userId: session.userId, direction: 'COMMITMENT', status: { in: ['OPEN', 'IN_PROGRESS'] }, OR: [{ aiConfidence: { gte: 0.3 } }, { aiConfidence: 0 }] } }),
      prisma.task.count({ where: { userId: session.userId, status: { in: ['OPEN', 'IN_PROGRESS'] }, dueDate: { lt: new Date() }, OR: [{ aiConfidence: { gte: 0.3 } }, { aiConfidence: 0 }] } }),
      prisma.task.count({ where: { userId: session.userId, status: 'COMPLETED' } }),
    ]);

    return NextResponse.json({
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        context: t.context,
        direction: t.direction,
        status: t.status,
        priority: t.priority,
        assignedTo: t.assignedTo,
        assignedToName: t.assignedToName,
        assignedBy: t.assignedBy,
        assignedByName: t.assignedByName,
        detectedAt: t.detectedAt.toISOString(),
        dueDate: t.dueDate?.toISOString() ?? null,
        completedAt: t.completedAt?.toISOString() ?? null,
        snoozedUntil: t.snoozedUntil?.toISOString() ?? null,
        aiConfidence: t.aiConfidence,
        suggestedAction: t.suggestedAction,
        aiExplanation: t.aiExplanation,
        chatTopic: t.chat.topic,
        chatType: t.chat.chatType,
      })),
      stats: { assignedToMe, assignedByMe, commitments, overdue, completed },
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to load tasks' }, { status: 500 });
  }
}
