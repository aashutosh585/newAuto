import { Request, Response } from 'express';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { prisma, RunStatus } from '@social-engine/db';
import { generateIdempotencyKey } from '@social-engine/core';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379/0';
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const pipelineQueue = new Queue('pipeline-queue', {
  connection: redis as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export async function handleCronRun(req: Request, res: Response): Promise<void> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization?.replace(/^Bearer\s+/, '');
  const querySecret = req.query.secret as string | undefined;

  // 1. Verify CRON_SECRET
  if (!cronSecret || (authHeader !== cronSecret && querySecret !== cronSecret)) {
    res.status(401).json({ error: 'Unauthorized: Invalid or missing CRON_SECRET' });
    return;
  }

  // 2. Check Global Kill Switch
  if (process.env.ENGINE_KILL_SWITCH === 'true') {
    res.status(503).json({
      error: 'Service Unavailable: ENGINE_KILL_SWITCH is currently active. Run rejected.',
    });
    return;
  }

  const slot = (req.query.slot as string) || (req.body?.slot as string) || 'default_slot';
  const niche = (req.query.niche as string) || (req.body?.niche as string) || process.env.ACTIVE_NICHE || 'jobs';
  const triggerSource = (req.query.source as string) || 'cron';

  // 3. Enforce Idempotency Key per Slot (Never Double-Post)
  const idempotencyKey = generateIdempotencyKey(niche, slot);

  // Check if run already exists for this slot today
  const existingRun = await prisma.run.findUnique({
    where: { idempotencyKey },
    include: { stages: true },
  });

  if (existingRun) {
    res.status(200).json({
      success: true,
      idempotent: true,
      message: `Run already created for slot "${slot}" today (${existingRun.status})`,
      run: existingRun,
    });
    return;
  }

  try {
    // 4. Create new Run record
    const run = await prisma.run.create({
      data: {
        slot,
        niche,
        status: RunStatus.PENDING,
        idempotencyKey,
        triggerSource,
      },
    });

    // 5. Enqueue to BullMQ worker
    await pipelineQueue.add(
      `run-${run.id}`,
      {
        runId: run.id,
        slot,
        niche,
        triggerSource,
      },
      {
        jobId: run.id,
      }
    );

    res.status(202).json({
      success: true,
      message: `Pipeline triggered successfully for slot "${slot}" [${niche}]`,
      runId: run.id,
      idempotencyKey,
      status: run.status,
    });
  } catch (err: any) {
    console.error('[Cron] Failed to schedule run:', err);
    res.status(500).json({ error: 'Failed to initialize run', details: err.message });
  }
}

