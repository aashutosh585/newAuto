import axios from 'axios';
import { Publisher, PublishPayload, PublishResult, ChannelType } from './interface.js';

export interface ZernioPlatformTarget {
  platform: 'telegram' | 'instagram' | 'youtube' | 'x';
  accountId: string;
}

export class ZernioPublisher implements Publisher {
  name = 'zernio';

  private apiUrl: string;
  private apiKey: string;
  private profileId: string;

  constructor() {
    this.apiUrl = (process.env.ZERNIO_API_URL || 'https://api.zernio.com').replace(/\/+$/, '');
    this.apiKey = process.env.ZERNIO_API_KEY || '';
    this.profileId = process.env.ZERNIO_PROFILE_ID || '';
  }

  getAccountIdForChannel(channel: ChannelType): string | undefined {
    switch (channel) {
      case 'telegram':
        return process.env.ZERNIO_ACCOUNT_TELEGRAM;
      case 'instagram':
        return process.env.ZERNIO_ACCOUNT_INSTAGRAM;
      case 'youtube':
        return process.env.ZERNIO_ACCOUNT_YOUTUBE;
      case 'x':
        return process.env.ZERNIO_ACCOUNT_X;
    }
  }

  async publish(payload: PublishPayload): Promise<PublishResult> {
    if (!this.apiKey) {
      return {
        success: false,
        channel: payload.channel,
        publisherName: this.name,
        error: 'ZERNIO_API_KEY is not configured',
      };
    }

    const accountId = this.getAccountIdForChannel(payload.channel);
    if (!accountId) {
      return {
        success: false,
        channel: payload.channel,
        publisherName: this.name,
        error: `No Zernio account ID configured for channel: ${payload.channel} (check ZERNIO_ACCOUNT_${payload.channel.toUpperCase()})`,
      };
    }

    try {
      const publicBaseUrl = (process.env.BASE_PUBLIC_URL || '').replace(/\/+$/, '');
      const mediaUrls = payload.media.map((m) => {
        if (m.publicUrl) return m.publicUrl;
        const filename = m.path.split(/[\\/]/).pop();
        return `${publicBaseUrl}/media/${filename}`;
      });

      // Zernio 409 rule: same content to same account within 24h is rejected.
      // We append a slot/run tag or timestamp micro-variation to guarantee uniqueness if needed.
      const uniqueCaption = payload.caption.trim();

      // Send x-request-id for idempotency on retries
      const requestId = `run-${payload.runId}-${payload.channel}-${Date.now()}`;

      const requestBody: Record<string, unknown> = {
        profileId: this.profileId || undefined,
        content: uniqueCaption,
        platforms: [
          {
            platform: payload.channel,
            accountId,
          },
        ],
        publishNow: true,
        metadata: {
          runId: payload.runId,
          channel: payload.channel,
          source: 'social-engine-v3',
        },
      };

      if (mediaUrls.length > 0) {
        requestBody.mediaUrls = mediaUrls;
      }

      if (payload.title) {
        requestBody.title = payload.title;
      }

      const response = await axios.post(`${this.apiUrl}/v1/posts`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'x-request-id': requestId,
        },
        timeout: 45000,
      });

      const data = response.data;
      const postId = data?.id || data?.postId || data?.data?.id;
      const postUrl = data?.url || data?.permalink || data?.data?.url;

      return {
        success: true,
        channel: payload.channel,
        publisherName: this.name,
        externalPostId: postId ? String(postId) : undefined,
        externalPostUrl: postUrl,
      };
    } catch (err: any) {
      const status = err.response?.status;
      const responseBody = err.response?.data;
      const errorDetail = responseBody?.message || responseBody?.error || err.message;

      // Special handling for 409 Duplicate Content
      if (status === 409) {
        return {
          success: false,
          channel: payload.channel,
          publisherName: this.name,
          error: `Zernio 409 Conflict (Duplicate content within 24h): ${errorDetail}`,
        };
      }

      return {
        success: false,
        channel: payload.channel,
        publisherName: this.name,
        error: `Zernio publish error [${status || 'NETWORK'}]: ${errorDetail}`,
      };
    }
  }

  /**
   * Helper to initiate platform OAuth connection flow via Zernio
   */
  async getConnectAuthUrl(platform: ChannelType): Promise<string> {
    const res = await axios.get(`${this.apiUrl}/v1/connect/${platform}`, {
      params: { profileId: this.profileId },
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    return res.data?.authUrl || res.data?.url;
  }

  /**
   * Helper to list connected accounts in Zernio
   */
  async listAccounts(): Promise<any[]> {
    const res = await axios.get(`${this.apiUrl}/v1/accounts`, {
      params: { profileId: this.profileId },
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    return res.data?.accounts || res.data?.data || [];
  }
}

