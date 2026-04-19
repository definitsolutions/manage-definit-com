import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TranscriptionService } from '../services/transcription';
import { EmailService } from '../services/email';
import { StorageService } from '../services/storage';

export async function recordingRoutes(fastify: FastifyInstance) {
  const storage = new StorageService(fastify.config);
  const transcription = new TranscriptionService(fastify.config, storage);
  const email = new EmailService(fastify.config);

  // Upload a new recording
  fastify.post('/api/recordings', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    // Collect fields from multipart
    const fields: Record<string, string> = {};
    for (const [key, field] of Object.entries(data.fields)) {
      if (field && typeof field === 'object' && 'value' in field) {
        fields[key] = (field as any).value;
      }
    }

    const phoneNumber = fields.phone_number;
    const direction = fields.direction;
    const startedAt = fields.started_at;
    const durationSeconds = fields.duration_seconds;

    if (!phoneNumber || !direction || !startedAt) {
      return reply.code(400).send({
        error: 'Missing required fields: phone_number, direction, started_at',
      });
    }

    if (!['incoming', 'outgoing'].includes(direction)) {
      return reply.code(400).send({ error: 'direction must be "incoming" or "outgoing"' });
    }

    // Read file buffer
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    // Generate filename and save
    const id = crypto.randomUUID();
    const ext = data.filename?.split('.').pop() || 'm4a';
    const filename = `${id}.${ext}`;

    const { size } = await storage.saveFile(filename, fileBuffer);

    // Create DB record
    const recording = await fastify.prisma.recording.create({
      data: {
        id,
        phoneNumber,
        direction,
        startedAt: new Date(startedAt),
        durationSeconds: durationSeconds ? parseInt(durationSeconds, 10) : null,
        audioFilePath: filename,
        audioFileSize: BigInt(size),
        transcriptStatus: 'pending',
      },
    });

    // Fire-and-forget transcription
    processRecording(fastify, transcription, email, id).catch((err) => {
      fastify.log.error({ err, recordingId: id }, 'Background transcription failed');
    });

    return reply.code(201).send({
      id: recording.id,
      status: recording.transcriptStatus,
      created_at: recording.createdAt.toISOString(),
    });
  });

  // List recordings
  fastify.get('/api/recordings', async (request: FastifyRequest, reply: FastifyReply) => {
    const { page = '1', limit = '20', phone_number } = request.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = phone_number ? { phoneNumber: phone_number } : {};

    const [recordings, total] = await Promise.all([
      fastify.prisma.recording.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true,
          phoneNumber: true,
          direction: true,
          startedAt: true,
          durationSeconds: true,
          transcriptStatus: true,
          emailSent: true,
          createdAt: true,
        },
      }),
      fastify.prisma.recording.count({ where }),
    ]);

    return {
      recordings: recordings.map((r) => ({
        id: r.id,
        phone_number: r.phoneNumber,
        direction: r.direction,
        started_at: r.startedAt.toISOString(),
        duration_seconds: r.durationSeconds,
        transcript_status: r.transcriptStatus,
        email_sent: r.emailSent,
        created_at: r.createdAt.toISOString(),
      })),
      total,
      page: pageNum,
      limit: limitNum,
    };
  });

  // Get recording status
  fastify.get('/api/recordings/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const recording = await fastify.prisma.recording.findUnique({
      where: { id },
      select: {
        id: true,
        transcriptStatus: true,
        emailSent: true,
        emailSentAt: true,
        transcriptError: true,
      },
    });

    if (!recording) {
      return reply.code(404).send({ error: 'Recording not found' });
    }

    return {
      id: recording.id,
      transcript_status: recording.transcriptStatus,
      email_sent: recording.emailSent,
      email_sent_at: recording.emailSentAt?.toISOString() || null,
      error: recording.transcriptError,
    };
  });

  // Get full transcript
  fastify.get('/api/recordings/:id/transcript', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const recording = await fastify.prisma.recording.findUnique({
      where: { id },
      select: {
        id: true,
        transcript: true,
        transcriptStatus: true,
      },
    });

    if (!recording) {
      return reply.code(404).send({ error: 'Recording not found' });
    }

    return {
      id: recording.id,
      transcript_status: recording.transcriptStatus,
      transcript: recording.transcript,
    };
  });
}

async function processRecording(
  fastify: FastifyInstance,
  transcription: TranscriptionService,
  email: EmailService,
  recordingId: string,
): Promise<void> {
  await fastify.prisma.recording.update({
    where: { id: recordingId },
    data: { transcriptStatus: 'processing' },
  });

  try {
    const recording = await fastify.prisma.recording.findUniqueOrThrow({
      where: { id: recordingId },
    });

    // Transcribe: Whisper STT -> Claude formatting
    const transcript = await transcription.transcribe(
      recording.audioFilePath,
      recording.phoneNumber,
      recording.direction,
      recording.startedAt,
      recording.durationSeconds,
    );

    await fastify.prisma.recording.update({
      where: { id: recordingId },
      data: { transcriptStatus: 'completed', transcript },
    });

    // Send email
    try {
      await email.sendTranscript(
        recording.phoneNumber,
        recording.direction,
        recording.startedAt,
        transcript,
      );

      await fastify.prisma.recording.update({
        where: { id: recordingId },
        data: { emailSent: true, emailSentAt: new Date() },
      });

      fastify.log.info({ recordingId }, 'Transcript emailed successfully');
    } catch (emailErr) {
      fastify.log.error({ err: emailErr, recordingId }, 'Failed to send transcript email');
      await fastify.prisma.recording.update({
        where: { id: recordingId },
        data: { emailError: emailErr instanceof Error ? emailErr.message : String(emailErr) },
      });
    }
  } catch (err) {
    fastify.log.error({ err, recordingId }, 'Transcription failed');
    await fastify.prisma.recording.update({
      where: { id: recordingId },
      data: {
        transcriptStatus: 'failed',
        transcriptError: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

// Re-export for startup sweep
export { processRecording };
