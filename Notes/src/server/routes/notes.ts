import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/db.js';

export async function noteRoutes(app: FastifyInstance) {
  // GET /api/notes?archived=&trashed=&labelId=&search=&visibility=
  app.get('/', async (request) => {
    const { archived, trashed, labelId, search, visibility } = request.query as Record<string, string>;

    const where: any = {};

    if (trashed === 'true') {
      where.trashed = true;
      // In trash, only show own notes
      where.userId = request.user.id;
    } else {
      where.trashed = false;
      if (archived === 'true') {
        where.archived = true;
        where.userId = request.user.id;
      } else {
        where.archived = false;
        // Show user's own notes + all public notes
        where.OR = [
          { userId: request.user.id },
          { visibility: 'public' },
        ];
      }
    }

    if (labelId) {
      where.noteLabels = { some: { labelId } };
    }

    if (search) {
      const searchCondition = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
      // Merge search with existing OR if present
      if (where.OR) {
        const existingOr = where.OR;
        delete where.OR;
        where.AND = [
          { OR: existingOr },
          { OR: searchCondition },
        ];
      } else {
        where.OR = searchCondition;
      }
    }

    // Filter by visibility if specified
    if (visibility === 'public') {
      // Override OR to only show public
      delete where.OR;
      if (where.AND) {
        where.AND = where.AND.filter((c: any) => !c.OR?.some((o: any) => o.visibility));
      }
      where.visibility = 'public';
      where.trashed = false;
      where.archived = false;
    } else if (visibility === 'private') {
      delete where.OR;
      if (where.AND) {
        where.AND = where.AND.filter((c: any) => !c.OR?.some((o: any) => o.visibility));
      }
      where.userId = request.user.id;
      where.visibility = 'private';
    }

    const notes = await prisma.note.findMany({
      where,
      include: {
        checklistItems: { orderBy: { sortOrder: 'asc' } },
        noteLabels: { include: { label: true } },
        user: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: [
        { pinned: 'desc' },
        { sortOrder: 'asc' },
        { updatedAt: 'desc' },
      ],
    });

    return { notes };
  });

  // POST /api/notes
  app.post('/', async (request, reply) => {
    const body = request.body as any;

    // Get max sortOrder for this user
    const maxSort = await prisma.note.aggregate({
      where: { userId: request.user.id, archived: false, trashed: false },
      _max: { sortOrder: true },
    });

    const note = await prisma.note.create({
      data: {
        userId: request.user.id,
        title: body.title || '',
        content: body.content || '',
        color: body.color || 'default',
        pinned: body.pinned || false,
        visibility: body.visibility || 'private',
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });

    if (body.checklistItems?.length > 0) {
      await prisma.checklistItem.createMany({
        data: body.checklistItems.map((item: any, i: number) => ({
          noteId: note.id,
          text: item.text,
          checked: item.checked || false,
          sortOrder: i,
        })),
      });
    }

    const full = await prisma.note.findUnique({
      where: { id: note.id },
      include: {
        checklistItems: { orderBy: { sortOrder: 'asc' } },
        noteLabels: { include: { label: true } },
        user: { select: { id: true, displayName: true, email: true } },
      },
    });

    return reply.status(201).send({ note: full });
  });

  // PATCH /api/notes/:id
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const existing = await prisma.note.findUnique({ where: { id } });
    if (!existing || existing.userId !== request.user.id) {
      return reply.status(404).send({ error: 'Note not found' });
    }

    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.pinned !== undefined) updateData.pinned = body.pinned;
    if (body.visibility !== undefined) updateData.visibility = body.visibility;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

    const note = await prisma.note.update({
      where: { id },
      data: updateData,
      include: {
        checklistItems: { orderBy: { sortOrder: 'asc' } },
        noteLabels: { include: { label: true } },
        user: { select: { id: true, displayName: true, email: true } },
      },
    });

    return { note };
  });

  // POST /api/notes/reorder
  app.post('/reorder', async (request, reply) => {
    const { noteIds } = request.body as { noteIds: string[] };

    if (!noteIds || !Array.isArray(noteIds)) {
      return reply.status(400).send({ error: 'noteIds array is required' });
    }

    // Only allow reordering own notes
    const updates = noteIds.map((id, index) =>
      prisma.note.updateMany({
        where: { id, userId: request.user.id },
        data: { sortOrder: index },
      })
    );

    await prisma.$transaction(updates);
    return { success: true };
  });

  // POST /api/notes/:id/archive
  app.post('/:id/archive', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.note.findUnique({ where: { id } });
    if (!existing || existing.userId !== request.user.id) {
      return reply.status(404).send({ error: 'Note not found' });
    }
    const note = await prisma.note.update({
      where: { id },
      data: { archived: true, pinned: false },
    });
    return { note };
  });

  // POST /api/notes/:id/unarchive
  app.post('/:id/unarchive', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.note.findUnique({ where: { id } });
    if (!existing || existing.userId !== request.user.id) {
      return reply.status(404).send({ error: 'Note not found' });
    }
    const note = await prisma.note.update({
      where: { id },
      data: { archived: false },
    });
    return { note };
  });

  // POST /api/notes/:id/trash
  app.post('/:id/trash', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.note.findUnique({ where: { id } });
    if (!existing || existing.userId !== request.user.id) {
      return reply.status(404).send({ error: 'Note not found' });
    }
    const note = await prisma.note.update({
      where: { id },
      data: { trashed: true, pinned: false, trashedAt: new Date() },
    });
    return { note };
  });

  // POST /api/notes/:id/restore
  app.post('/:id/restore', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.note.findUnique({ where: { id } });
    if (!existing || existing.userId !== request.user.id) {
      return reply.status(404).send({ error: 'Note not found' });
    }
    const note = await prisma.note.update({
      where: { id },
      data: { trashed: false, trashedAt: null },
    });
    return { note };
  });

  // DELETE /api/notes/:id (permanent)
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.note.findUnique({ where: { id } });
    if (!existing || existing.userId !== request.user.id) {
      return reply.status(404).send({ error: 'Note not found' });
    }
    await prisma.note.delete({ where: { id } });
    return { success: true };
  });

  // --- Checklist Items ---

  app.post('/:id/checklist', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const note = await prisma.note.findUnique({ where: { id } });
    if (!note || note.userId !== request.user.id) {
      return reply.status(404).send({ error: 'Note not found' });
    }
    const maxOrder = await prisma.checklistItem.aggregate({
      where: { noteId: id },
      _max: { sortOrder: true },
    });
    const item = await prisma.checklistItem.create({
      data: {
        noteId: id,
        text: body.text || '',
        checked: body.checked || false,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
    return reply.status(201).send({ item });
  });

  app.patch('/:id/checklist/:itemId', async (request, reply) => {
    const { id, itemId } = request.params as { id: string; itemId: string };
    const body = request.body as any;
    const note = await prisma.note.findUnique({ where: { id } });
    if (!note || note.userId !== request.user.id) {
      return reply.status(404).send({ error: 'Note not found' });
    }
    const updateData: any = {};
    if (body.text !== undefined) updateData.text = body.text;
    if (body.checked !== undefined) updateData.checked = body.checked;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    const item = await prisma.checklistItem.update({
      where: { id: itemId },
      data: updateData,
    });
    return { item };
  });

  app.delete('/:id/checklist/:itemId', async (request, reply) => {
    const { id, itemId } = request.params as { id: string; itemId: string };
    const note = await prisma.note.findUnique({ where: { id } });
    if (!note || note.userId !== request.user.id) {
      return reply.status(404).send({ error: 'Note not found' });
    }
    await prisma.checklistItem.delete({ where: { id: itemId } });
    return { success: true };
  });

  // --- Note Labels ---

  app.post('/:id/labels/:labelId', async (request, reply) => {
    const { id, labelId } = request.params as { id: string; labelId: string };
    const note = await prisma.note.findUnique({ where: { id } });
    if (!note || note.userId !== request.user.id) {
      return reply.status(404).send({ error: 'Note not found' });
    }
    const existing = await prisma.noteLabel.findUnique({
      where: { noteId_labelId: { noteId: id, labelId } },
    });
    if (existing) return { noteLabel: existing };
    const noteLabel = await prisma.noteLabel.create({
      data: { noteId: id, labelId },
      include: { label: true },
    });
    return reply.status(201).send({ noteLabel });
  });

  app.delete('/:id/labels/:labelId', async (request, reply) => {
    const { id, labelId } = request.params as { id: string; labelId: string };
    const note = await prisma.note.findUnique({ where: { id } });
    if (!note || note.userId !== request.user.id) {
      return reply.status(404).send({ error: 'Note not found' });
    }
    await prisma.noteLabel.deleteMany({ where: { noteId: id, labelId } });
    return { success: true };
  });
}
