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

  // 1. Verify CRON_SECRET
  if (cronSecret && authHeader !== cronSecret && querySecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized: Invalid CRON_SECRET' }, { status: 401 });
  }

  // 2. Kill switch check
  if (process.env.ENGINE_KILL_SWITCH === 'true') {
    return NextResponse.json({ error: 'Engine paused via ENGINE_KILL_SWITCH' }, { status: 503 });
  }

  const slot = searchParams.get('slot') || 'daily_slot';
  // type: 'image' (carousel only) | 'video' (video + carousel) | 'all' (default = image)
  const pipelineType = (searchParams.get('type') || 'image') as 'image' | 'video' | 'all';
  const idempotencyKey = generateIdempotencyKey(`${slot}_${pipelineType}`);

  await connectToDatabase();

  // 3. Prevent duplicate runs for same slot+type today
  const existingRun = await Run.findOne({ idempotencyKey });
  if (existingRun) {
    return NextResponse.json(
      {
        success: true,
        idempotent: true,
        message: `Run already executed for slot "${slot}" (${pipelineType}) today — status: ${existingRun.status}`,
        runId: existingRun._id,
      },
      { status: 200 }
    );
  }

  // 4. Create Run record
  const run = await Run.create({
    slot: `${slot}:${pipelineType}`,
    idempotencyKey,
    status: 'pending',
    triggerSource: searchParams.get('source') || 'external_cron',
    stages: [],
  });

  const runIdStr = run._id.toString();

  // 5. Fire pipeline async — instant 200 response to cron caller
  (async () => {
    try {
      await runSocialPipeline(runIdStr, slot, pipelineType);
    } catch (err: any) {
      console.error(`[Background Run Error] Run ${runIdStr}:`, err);
    }
  })();

  return NextResponse.json(
    {
      success: true,
      message: `Pipeline started: type="${pipelineType}", slot="${slot}"`,
      runId: run._id,
      idempotencyKey,
      pipelineType,
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
