import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import LlmCall from '@/models/LlmCall';
import { isAuthenticated } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const authed = await isAuthenticated();
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const runId = searchParams.get('runId');

  const filter: any = {};
  if (runId) filter.runId = runId;

  const [calls, totals] = await Promise.all([
    LlmCall.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    LlmCall.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          totalTokens: { $sum: '$totalTokens' },
          totalCostUsd: { $sum: '$estimatedCostUsd' },
          avgLatencyMs: { $avg: '$latencyMs' },
          successCount: { $sum: { $cond: ['$success', 1, 0] } },
        },
      },
    ]),
  ]);

  const summary = totals[0] || {
    totalCalls: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    avgLatencyMs: 0,
    successCount: 0,
  };

  return NextResponse.json({ calls, summary });
}

