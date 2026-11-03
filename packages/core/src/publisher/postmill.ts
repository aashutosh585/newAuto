import axios from 'axios';
import { Publisher, PublishPayload, PublishResult } from './interface.js';

export class PostmillPublisher implements Publisher {
  name = 'postmill';

  async publish(payload: PublishPayload): Promise<PublishResult> {
    const apiUrl = process.env.POSTMILL_API_URL || 'http://postmill:3000/api';
    const apiKey = process.env.POSTMILL_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        channel: payload.channel,
        publisherName: this.name,
        error: 'POSTMILL_API_KEY is not configured',
      };
    }

    try {
      const publicBaseUrl = (process.env.BASE_PUBLIC_URL || '').replace(/\/+$/, '');
      const mediaUrls = payload.media.map((m) => {
        if (m.publicUrl) return m.publicUrl;
        const filename = m.path.split(/[\\/]/).pop();
        return `${publicBaseUrl}/media/${filename}`;
      });

      const requestBody = {
        title: payload.title || 'Social Engine Post',
        content: payload.caption,
        platforms: [payload.channel],
        media: mediaUrls,
        tags: payload.tags || [],
        metadata: {
          runId: payload.runId,
          source: 'social-engine',
        },
      };

      const res = await axios.post(`${apiUrl.replace(/\/+$/, '')}/v1/posts`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 45000,
      });

      const postId = res.data?.id || res.data?.post_id;
      const postUrl = res.data?.url || res.data?.permalink;

      return {
        success: true,
        channel: payload.channel,
        publisherName: this.name,
        externalPostId: postId ? String(postId) : undefined,
        externalPostUrl: postUrl,
      };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Postmill publishing failed';
      return {
        success: false,
        channel: payload.channel,
        publisherName: this.name,
        error: errorMsg,
      };
    }
  }
}
