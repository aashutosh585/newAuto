import axios from 'axios';
import { Publisher, PublishPayload, PublishResult } from './interface.js';

export class InstagramPublisher implements Publisher {
  name = 'direct_instagram';

  async publish(payload: PublishPayload): Promise<PublishResult> {
    const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;

    if (!igAccountId || !accessToken) {
      return {
        success: false,
        channel: 'instagram',
        publisherName: this.name,
        error: 'INSTAGRAM_ACCOUNT_ID or META_ACCESS_TOKEN is not configured',
      };
    }

    try {
      const publicBaseUrl = (process.env.BASE_PUBLIC_URL || '').replace(/\/+$/, '');
      const validMediaUrls = payload.media.map((m) => {
        if (m.publicUrl) return m.publicUrl;
        // If relative or filename, prefix with base public media url
        const filename = m.path.split(/[\\/]/).pop();
        return `${publicBaseUrl}/media/${filename}`;
      });

      if (validMediaUrls.length === 0) {
        throw new Error('Instagram requires at least one public image URL for posting');
      }

      // Single Image Publish
      if (validMediaUrls.length === 1) {
        const createContainerRes = await axios.post(
          `https://graph.facebook.com/v19.0/${igAccountId}/media`,
          null,
          {
            params: {
              image_url: validMediaUrls[0],
              caption: payload.caption,
              access_token: accessToken,
            },
            timeout: 30000,
          }
        );

        const containerId = createContainerRes.data?.id;
        if (!containerId) {
          throw new Error('Failed to get Instagram media container ID');
        }

        // Wait briefly for Instagram to process the container
        await new Promise((r) => setTimeout(r, 2000));

        const publishRes = await axios.post(
          `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
          null,
          {
            params: {
              creation_id: containerId,
              access_token: accessToken,
            },
            timeout: 30000,
          }
        );

        const publishedPostId = publishRes.data?.id;
        return {
          success: true,
          channel: 'instagram',
          publisherName: this.name,
          externalPostId: publishedPostId,
          externalPostUrl: `https://www.instagram.com/p/${publishedPostId}/`,
        };
      }

      // Multi-image Carousel Publish
      const childContainerIds: string[] = [];

      for (const mediaUrl of validMediaUrls) {
        const itemRes = await axios.post(
          `https://graph.facebook.com/v19.0/${igAccountId}/media`,
          null,
          {
            params: {
              image_url: mediaUrl,
              is_carousel_item: true,
              access_token: accessToken,
            },
            timeout: 30000,
          }
        );
        if (itemRes.data?.id) {
          childContainerIds.push(itemRes.data.id);
        }
      }

      if (childContainerIds.length < validMediaUrls.length) {
        throw new Error('Failed to create all child items for Instagram carousel');
      }

      // Create carousel parent container
      const carouselContainerRes = await axios.post(
        `https://graph.facebook.com/v19.0/${igAccountId}/media`,
        null,
        {
          params: {
            media_type: 'CAROUSEL',
            children: childContainerIds.join(','),
            caption: payload.caption,
            access_token: accessToken,
          },
          timeout: 30000,
        }
      );

      const carouselId = carouselContainerRes.data?.id;
      if (!carouselId) {
        throw new Error('Failed to create Instagram carousel container');
      }

      // Wait 3 seconds for Instagram processing
      await new Promise((r) => setTimeout(r, 3000));

      const publishRes = await axios.post(
        `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
        null,
        {
          params: {
            creation_id: carouselId,
            access_token: accessToken,
          },
          timeout: 30000,
        }
      );

      const publishedPostId = publishRes.data?.id;
      return {
        success: true,
        channel: 'instagram',
        publisherName: this.name,
        externalPostId: publishedPostId,
        externalPostUrl: `https://www.instagram.com/p/${publishedPostId}/`,
      };
    } catch (err: any) {
      const errorMsg = err.response?.data?.error?.message || err.message || 'Instagram publishing failed';
      return {
        success: false,
        channel: 'instagram',
        publisherName: this.name,
        error: errorMsg,
      };
    }
  }
}

