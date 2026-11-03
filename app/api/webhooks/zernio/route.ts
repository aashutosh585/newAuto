import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import connectToDatabase from '@/lib/mongodb';
import Post from '@/models/Post';
import PostMetric from '@/models/PostMetric';

/**
 * Zernio fires webhooks here when:
 *   - A post is published / failed
 *   - Analytics update (likes, reach, comments)
 *
 * Configure in Zernio dashboard:
 *   Webhook URL: https://your-domain.vercel.app/api/webhooks/zernio
 *   Secret: ZERNIO_WEBHOOK_SECRET in .env
 */
export async function POST(req: NextRequest) {
  // Verify Zernio webhook signature if secret is configured
  const secret = process.env.ZERNIO_WEBHOOK_SECRET;
  if (secret) {
    const signature = req.headers.get('x-zernio-signature') || req.headers.get('x-signature');
    if (signature) {
      const rawBody = await req.text();
      const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');
      if (signature !== expected && `sha256=${signature}` !== expected) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
      // Re-parse since we consumed the body
      try {
        const payload = JSON.parse(rawBody);
        return await handleEvent(payload);
      } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }
    }
  }

  // No signature check — parse normally
  try {
    const payload = await req.json();
    return await handleEvent(payload);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
}

async function handleEvent(payload: any) {
  await connectToDatabase();

  const event = payload?.event || payload?.type || '';
  const data = payload?.data || payload;

  console.log('[Webhook/Zernio] Event received:', event, JSON.stringify(data).slice(0, 300));

  try {
    if (event === 'post.published' || event === 'post.created') {
      // Mark post as published in our DB
      const externalId = data?.post?._id || data?.post?.id || data?._id || data?.id;
      const platform = data?.post?.platform || data?.platform;
      const postUrl = data?.post?.url || data?.url;

      if (externalId) {
        await Post.findOneAndUpdate(
          { externalPostId: externalId },
          { status: 'published', postUrl, platform },
          { upsert: false }
        );
      }
    }

    if (event === 'post.failed') {
      const externalId = data?.post?._id || data?.post?.id || data?._id;
      const errorMsg = data?.error || data?.message || 'Unknown publish failure';

      if (externalId) {
        await Post.findOneAndUpdate(
          { externalPostId: externalId },
          { status: 'failed', errorMessage: errorMsg }
        );
      }

      // Send Telegram alert if configured
      const alertToken = process.env.ALERT_TELEGRAM_BOT_TOKEN;
      const alertChat = process.env.ALERT_CHAT_ID;
      if (alertToken && alertChat) {
        const msg = `⚠️ Zernio post FAILED\nPlatform: ${data?.platform || 'unknown'}\nError: ${errorMsg}`;
        await fetch(`https://api.telegram.org/bot${alertToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: alertChat, text: msg }),
        }).catch(() => {});
      }
    }

    if (event === 'post.analytics' || event === 'analytics.update') {
      const externalId = data?.post?._id || data?.post?.id || data?.postId;
      const platform = data?.platform || data?.post?.platform;

      if (externalId) {
        const post = await Post.findOne({ externalPostId: externalId });
        if (post) {
          await PostMetric.findOneAndUpdate(
            { postId: String(post._id), platform },
            {
              postId: String(post._id),
              platform,
              externalPostId: externalId,
              likes: data?.likes ?? data?.analytics?.likes ?? 0,
              reach: data?.reach ?? data?.analytics?.reach ?? 0,
              impressions: data?.impressions ?? data?.analytics?.impressions ?? 0,
              comments: data?.comments ?? data?.analytics?.comments ?? 0,
              shares: data?.shares ?? data?.analytics?.shares ?? 0,
              saves: data?.saves ?? data?.analytics?.saves ?? 0,
              clicks: data?.clicks ?? data?.analytics?.clicks ?? 0,
              fetchedAt: new Date(),
            },
            { upsert: true }
          );
        }
      }
    }
  } catch (err: any) {
    console.error('[Webhook/Zernio] Handler error:', err.message);
  }

  return NextResponse.json({ ok: true });
}

