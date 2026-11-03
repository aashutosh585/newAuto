import { Router, Request, Response } from 'express';
import { prisma, RunStatus, StageStatus, AccountStatus } from '@social-engine/db';
import { pipelineQueue } from './cron.js';

export const apiRouter: Router = Router();

// 1. Overview Metrics
apiRouter.get('/overview', async (req: Request, res: Response) => {
  try {
    const totalRuns = await prisma.run.count();
    const completedRuns = await prisma.run.count({ where: { status: RunStatus.COMPLETED } });
    const failedRuns = await prisma.run.count({ where: { status: RunStatus.FAILED } });
    const skippedRuns = await prisma.run.count({ where: { status: RunStatus.SKIPPED } });

    const totalPosts = await prisma.post.count();
    const publishedPosts = await prisma.post.count({ where: { status: 'PUBLISHED' } });

    const totalLlmCalls = await prisma.llmCall.count();
    const llmSpend = await prisma.llmCall.aggregate({
      _sum: {
        costUsd: true,
        totalTokens: true,
      },
    });

    const recentRuns = await prisma.run.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        stages: {
          select: { name: true, status: true, attempt: true, itemsIn: true, itemsOut: true },
        },
      },
    });

    res.json({
      runs: {
        total: totalRuns,
        completed: completedRuns,
        failed: failedRuns,
        skipped: skippedRuns,
        successRate: totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 100,
      },
      posts: {
        total: totalPosts,
        published: publishedPosts,
      },
      ai: {
        totalCalls: totalLlmCalls,
        totalTokens: llmSpend._sum.totalTokens || 0,
        totalCostUsd: Number((llmSpend._sum.costUsd || 0).toFixed(4)),
      },
      killSwitchActive: process.env.ENGINE_KILL_SWITCH === 'true',
      recentRuns,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Runs List & Details
apiRouter.get('/runs', async (req: Request, res: Response) => {
  try {
    const runs = await prisma.run.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        stages: {
          orderBy: { createdAt: 'asc' },
        },
        posts: true,
      },
    });
    res.json(runs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/runs/:id', async (req: Request, res: Response) => {
  try {
    const runId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const run = await prisma.run.findUnique({
      where: { id: runId },
      include: {
        stages: { orderBy: { createdAt: 'asc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 100 },
        llmCalls: { orderBy: { createdAt: 'desc' } },
        items: { take: 100 },
        rankedItems: { take: 50 },
        assets: true,
        posts: { include: { metrics: true } },
      },
    });

    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json(run);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. AI Activity
apiRouter.get('/ai', async (req: Request, res: Response) => {
  try {
    const calls = await prisma.llmCall.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    res.json(calls);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Posts & Zernio Status
apiRouter.get('/posts', async (req: Request, res: Response) => {
  try {
    const posts = await prisma.post.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        run: { select: { slot: true, niche: true } },
        metrics: { orderBy: { recordedAt: 'desc' }, take: 1 },
      },
    });
    res.json(posts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Jobs Data (Kept vs Dropped & Why)
apiRouter.get('/jobs', async (req: Request, res: Response) => {
  try {
    const items = await prisma.item.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        rankedItem: true,
      },
    });

    const dropStats = await prisma.item.groupBy({
      by: ['dropReason', 'status'],
      _count: true,
    });

    res.json({ items, dropStats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Accounts (Connection & Token Health)
apiRouter.get('/accounts', async (req: Request, res: Response) => {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { platform: 'asc' },
    });

    // Provide default status for connected platforms
    const defaultAccounts = [
      {
        platform: 'zernio',
        accountIdentifier: process.env.ZERNIO_PROFILE_ID || 'Active Profile',
        status: process.env.ZERNIO_API_KEY ? AccountStatus.HEALTHY : AccountStatus.ERROR,
        lastError: process.env.ZERNIO_API_KEY ? null : 'ZERNIO_API_KEY missing in .env',
      },
      {
        platform: 'telegram',
        accountIdentifier: process.env.ZERNIO_ACCOUNT_TELEGRAM || process.env.TELEGRAM_CHANNEL_ID || 'Telegram Channel',
        status: (process.env.ZERNIO_ACCOUNT_TELEGRAM || process.env.TELEGRAM_BOT_TOKEN) ? AccountStatus.HEALTHY : AccountStatus.ERROR,
        lastError: null,
      },
      {
        platform: 'instagram',
        accountIdentifier: process.env.ZERNIO_ACCOUNT_INSTAGRAM || 'Instagram Professional',
        status: process.env.ZERNIO_ACCOUNT_INSTAGRAM ? AccountStatus.HEALTHY : AccountStatus.EXPIRING_SOON,
        lastError: process.env.ZERNIO_ACCOUNT_INSTAGRAM ? null : 'Needs Zernio account connection',
      },
      {
        platform: 'youtube',
        accountIdentifier: process.env.ZERNIO_ACCOUNT_YOUTUBE || 'YouTube Channel',
        status: process.env.ZERNIO_ACCOUNT_YOUTUBE ? AccountStatus.HEALTHY : AccountStatus.ERROR,
        lastError: 'Planned for Step 8',
      },
      {
        platform: 'x',
        accountIdentifier: process.env.ZERNIO_ACCOUNT_X || 'X / Twitter',
        status: process.env.ZERNIO_ACCOUNT_X ? AccountStatus.HEALTHY : AccountStatus.ERROR,
        lastError: 'Needs paid tier card activation',
      },
    ];

    res.json(accounts.length > 0 ? accounts : defaultAccounts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Styles
apiRouter.get('/styles', async (req: Request, res: Response) => {
  try {
    const styles = await prisma.style.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(styles);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Settings & Controls
apiRouter.post('/settings/trigger', async (req: Request, res: Response) => {
  try {
    const slot = req.body.slot || 'manual_trigger';
    const niche = req.body.niche || process.env.ACTIVE_NICHE || 'jobs';

    const run = await prisma.run.create({
      data: {
        slot,
        niche,
        status: RunStatus.PENDING,
        idempotencyKey: `manual-${Date.now()}`,
        triggerSource: 'manual_dashboard',
      },
    });

    await pipelineQueue.add(
      `manual-run-${run.id}`,
      {
        runId: run.id,
        slot,
        niche,
        triggerSource: 'manual_dashboard',
      },
      { jobId: run.id }
    );

    res.json({ success: true, runId: run.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/settings/toggle-killswitch', async (req: Request, res: Response) => {
  const currentState = process.env.ENGINE_KILL_SWITCH === 'true';
  const newState = !currentState;
  process.env.ENGINE_KILL_SWITCH = String(newState);

  await prisma.setting.upsert({
    where: { key: 'ENGINE_KILL_SWITCH' },
    update: { value: newState },
    create: { key: 'ENGINE_KILL_SWITCH', value: newState, description: 'Master kill switch for cron pipeline' },
  });

  res.json({ success: true, killSwitchActive: newState });
});
