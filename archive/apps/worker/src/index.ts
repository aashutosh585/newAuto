import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { executePipeline, PipelineJobData } from './pipeline.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379/0';
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

console.log('[Worker] Starting Social Engine worker...');
console.log(`[Worker] Connected to Redis at ${redisUrl.replace(/:[^:@]*@/, ':***@')}`);

const worker = new Worker<PipelineJobData>(
  'pipeline-queue',
  async (job: Job<PipelineJobData>) => {
    console.log(`[Worker] Processing Job ID: ${job.id}, Run ID: ${job.data.runId}, Slot: ${job.data.slot}`);
    await executePipeline(job.data);
  },
  {
    connection: redis as any,
    concurrency: 1, // Bounded execution
    limiter: {
      max: 5,
      duration: 60000,
    },
  }
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} (Run: ${job.data?.runId}) finished.`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} (Run: ${job?.data?.runId}) failed with error:`, err);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('[Worker] Shutting down gracefully...');
  await worker.close();
  await redis.quit();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

