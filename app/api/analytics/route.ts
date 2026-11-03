import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Run from '@/models/Run';
import Post from '@/models/Post';
import PostMetric from '@/models/PostMetric';
import JobItem from '@/models/JobItem';
import LlmCall from '@/models/LlmCall';
import Asset from '@/models/Asset';
import { isAuthenticated } from '@/lib/auth';

export async function GET(_req: NextRequest) {
  const authed = await isAuthenticated();
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await connectToDatabase();

  const [
    runsToday,
    runsTotal,
    postsTotal,
    jobsTotal,
    jobsPassed,
    llmSummary,
    assetsTotal,
    recentPosts,
    platformBreakdown,
  ] = await Promise.all([
    // Runs today
    Run.countDocuments({
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
    // Total runs
    Run.countDocuments(),
    // Total posts published
    Post.countDocuments({ status: 'published' }),
    // Total jobs seen
    JobItem.countDocuments(),
    // Jobs that passed filter
    JobItem.countDocuments({ status: 'passed' }),
    // LLM aggregate
    LlmCall.aggregate([
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          totalTokens: { $sum: '$totalTokens' },
          totalCostUsd: { $sum: '$estimatedCostUsd' },
          successCount: { $sum: { $cond: ['$success', 1, 0] } },
        },
      },
    ]),
    // Total assets (images + videos)
    Asset.countDocuments(),
    // Recent posts with metrics
    Post.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    // Posts per platform
    Post.aggregate([
      { $group: { _id: '$platform', count: { $sum: 1 } } },
    ]),
  ]);

  // Enrich recent posts with metrics
  const postIds = recentPosts.map((p: any) => String(p._id));
  const metrics = await PostMetric.find({ postId: { $in: postIds } }).lean();
  const metricsMap: Record<string, any> = {};
  for (const m of metrics) {
    metricsMap[m.postId] = m;
  }

  const enrichedPosts = recentPosts.map((p: any) => ({
    ...p,
    metrics: metricsMap[String(p._id)] || null,
  }));

  const llm = llmSummary[0] || {
    totalCalls: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    successCount: 0,
  };

  return NextResponse.json({
    overview: {
      runsToday,
      runsTotal,
      postsTotal,
      jobsTotal,
      jobsPassed,
      assetsTotal,
      llmCalls: llm.totalCalls,
      llmTokens: llm.totalTokens,
      llmCostUsd: (llm.totalCostUsd || 0).toFixed(4),
      llmSuccessRate:
        llm.totalCalls > 0
          ? Math.round((llm.successCount / llm.totalCalls) * 100)
          : 100,
    },
    recentPosts: enrichedPosts,
    platformBreakdown: platformBreakdown.map((p: any) => ({
      platform: p._id,
      count: p.count,
    })),
  });
}

