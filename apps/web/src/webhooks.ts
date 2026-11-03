import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma, PostStatus } from '@social-engine/db';
import { sendTelegramAlert } from '@social-engine/core';

export async function handleZernioWebhook(req: Request, res: Response): Promise<void> {
  const secret = process.env.ZERNIO_WEBHOOK_SECRET;

  // Optional signature verification if webhook secret is configured
  if (secret) {
    const signature = req.headers['x-zernio-signature'] as string;
    if (signature) {
      const rawBody = JSON.stringify(req.body);
      const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      if (signature !== computed) {
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
    }
  }

  const payload = req.body;
  const eventType = payload?.event || payload?.type || 'post.status_changed';
  const data = payload?.data || payload;

  console.log(`[Zernio Webhook] Event received: ${eventType}`, JSON.stringify(data).slice(0, 300));

  try {
    const postId = data?.id || data?.postId || data?.external_id;
    const status = (data?.status || '').toLowerCase();
    const publicUrl = data?.url || data?.permalink;
    const errorMessage = data?.error || data?.failure_reason;

    if (postId) {
      // Find matching post in our database
      const existingPost = await prisma.post.findFirst({
        where: { externalPostId: String(postId) },
      });

      if (existingPost) {
        let postStatus: PostStatus = existingPost.status;
        if (status === 'published' || status === 'success') {
          postStatus = PostStatus.PUBLISHED;
        } else if (status === 'failed' || status === 'error') {
          postStatus = PostStatus.FAILED;
          await sendTelegramAlert(
            `❌ *[Zernio Post Failed]*\nPost ID: \`${postId}\`\nChannel: \`${existingPost.channel}\`\nReason: ${errorMessage || 'Unknown error'}`,
            true
          );
        }

        await prisma.post.update({
          where: { id: existingPost.id },
          data: {
            status: postStatus,
            externalPostUrl: publicUrl || existingPost.externalPostUrl,
            errorMessage: errorMessage || existingPost.errorMessage,
            publishedAt: postStatus === PostStatus.PUBLISHED ? new Date() : existingPost.publishedAt,
          },
        });

        // If engagement metrics are provided
        if (data.metrics) {
          await prisma.postMetric.create({
            data: {
              postId: existingPost.id,
              views: data.metrics.views || 0,
              likes: data.metrics.likes || 0,
              comments: data.metrics.comments || 0,
              shares: data.metrics.shares || 0,
              clicks: data.metrics.clicks || 0,
              rawMetrics: data.metrics,
            },
          });
        }
      }
    }

    res.status(200).json({ success: true, processed: true });
  } catch (err: any) {
    console.error('[Zernio Webhook] Processing error:', err);
    res.status(500).json({ error: 'Failed to process webhook', details: err.message });
  }
}
