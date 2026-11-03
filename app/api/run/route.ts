import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Run from '@/models/Run';
import { generateIdempotencyKey, runSocialPipeline } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

async function handleRunTrigger(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/, '');
  const searchParams = req.nextUrl.searchParams;
  const querySecret = searchParams.get('secret');

  // 1. Verify CRON_SECRET if defined
  if (cronSecret && authHeader !== cronSecret && querySecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized: Invalid CRON_SECRET' }, { status: 401 });
  }

  // 2. Kill switch check
  if (process.env.ENGINE_KILL_SWITCH === 'true') {
    return NextResponse.json({ error: 'Engine is currently paused via ENGINE_KILL_SWITCH' }, { status: 503 });
  }

  const slot = searchParams.get('slot') || 'daily_slot';
  const idempotencyKey = generateIdempotencyKey(slot);

  await connectToDatabase();

  // 3. Prevent duplicate executions for same slot on same day
  const existingRun = await Run.findOne({ idempotencyKey });
  if (existingRun) {
    return NextResponse.json(
      {
        success: true,
        idempotent: true,
        message: `Run already executed for slot "${slot}" today (${existingRun.status})`,
        runId: existingRun._id,
      },
      { status: 200 }
    );
  }

  // 4. Create new Run record in MongoDB
  const run = await Run.create({
    slot,
    idempotencyKey,
    status: 'pending',
    triggerSource: searchParams.get('source') || 'external_cron',
    stages: [],
  });

  // 5. Fire and start the pipeline asynchronously in background
  // We do NOT await this here so the external cron receives an immediate 200 OK response
  const runIdStr = run._id.toString();
  (async () => {
    try {
      await runSocialPipeline(runIdStr, slot, 'external_cron');
    } catch (err: any) {
      console.error(`[Background Run Error] Run ${runIdStr}:`, err);
    }
  })();

  // 6. Send immediate success response to external caller
  return NextResponse.json(
    {
      success: true,
      message: `Social Engine pipeline started successfully for slot "${slot}"`,
      runId: run._id,
      idempotencyKey,
      status: 'started',
    },
    { status: 200 }
  );
}

export async function GET(req: NextRequest) {
  return handleRunTrigger(req);
}

export async function POST(req: NextRequest) {
  return handleRunTrigger(req);
}

