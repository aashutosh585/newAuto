import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Run from '@/models/Run';
import { runSocialPipeline } from '@/lib/pipeline';
import { isAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const runs = await Run.find().sort({ createdAt: -1 }).limit(20);
    return NextResponse.json({ runs });
  } catch (err: any) {
    console.warn('[Runs API] DB query skipped:', err.message);
    return NextResponse.json({ runs: [], warning: err.message });
  }
}

export async function POST(req: NextRequest) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const body = await req.json().catch(() => ({}));
  const slot = body.slot || 'manual_dashboard';

  const run = await Run.create({
    slot,
    idempotencyKey: `manual-${Date.now()}`,
    status: 'pending',
    triggerSource: 'dashboard',
    stages: [],
  });

  const runIdStr = run._id.toString();
  (async () => {
    try {
      await runSocialPipeline(runIdStr, slot, 'dashboard');
    } catch (err: any) {
      console.error('[Manual Pipeline Error]:', err);
    }
  })();

  return NextResponse.json({
    success: true,
    message: 'Manual pipeline triggered successfully',
    runId: run._id,
  });
}

