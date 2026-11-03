import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { Publisher, PublishPayload, PublishResult } from './interface.js';

export class TelegramPublisher implements Publisher {
  name = 'direct_telegram';

  async publish(payload: PublishPayload): Promise<PublishResult> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const channelId = process.env.TELEGRAM_CHANNEL_ID;

    if (!token || !channelId) {
      return {
        success: false,
        channel: 'telegram',
        publisherName: this.name,
        error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID is not configured',
      };
    }

    try {
      // 1. If we have media images (carousel), sendMediaGroup
      if (payload.media && payload.media.length > 0) {
        if (payload.media.length === 1) {
          // Single photo
          const form = new FormData();
          form.append('chat_id', channelId);
          form.append('caption', payload.caption);
          form.append('parse_mode', 'HTML');

          const mediaItem = payload.media[0];
          if (fs.existsSync(mediaItem.path)) {
            form.append('photo', fs.createReadStream(mediaItem.path));
          } else if (mediaItem.publicUrl) {
            form.append('photo', mediaItem.publicUrl);
          } else {
            throw new Error(`Media file not found at ${mediaItem.path}`);
          }

          const res = await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, form, {
            headers: form.getHeaders(),
            timeout: 30000,
          });

          const msgId = res.data?.result?.message_id;
          const cleanChannel = channelId.replace('@', '');
          return {
            success: true,
            channel: 'telegram',
            publisherName: this.name,
            externalPostId: String(msgId),
            externalPostUrl: `https://t.me/${cleanChannel}/${msgId}`,
          };
        } else {
          // Carousel: sendMediaGroup (multi-photo)
          const form = new FormData();
          form.append('chat_id', channelId);

          const mediaGroup: Array<{ type: string; media: string; caption?: string; parse_mode?: string }> = [];

          payload.media.forEach((item, index) => {
            const attachName = `photo_${index}`;
            const groupItem: { type: string; media: string; caption?: string; parse_mode?: string } = {
              type: 'photo',
              media: `attach://${attachName}`,
            };

            // Telegram attaches caption to the first item of the group
            if (index === 0) {
              groupItem.caption = payload.caption.slice(0, 1024); // Telegram caption limit 1024 chars
              groupItem.parse_mode = 'HTML';
            }

            mediaGroup.push(groupItem);
            if (fs.existsSync(item.path)) {
              form.append(attachName, fs.createReadStream(item.path));
            } else {
              throw new Error(`Media file not found at ${item.path}`);
            }
          });

          form.append('media', JSON.stringify(mediaGroup));

          const res = await axios.post(`https://api.telegram.org/bot${token}/sendMediaGroup`, form, {
            headers: form.getHeaders(),
            timeout: 60000,
          });

          const messages = res.data?.result || [];
          const firstMsgId = messages[0]?.message_id;
          const cleanChannel = channelId.replace('@', '');

          return {
            success: true,
            channel: 'telegram',
            publisherName: this.name,
            externalPostId: String(firstMsgId),
            externalPostUrl: `https://t.me/${cleanChannel}/${firstMsgId}`,
          };
        }
      }

      // 2. Text only fallback
      const textRes = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: channelId,
        text: payload.caption,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }, { timeout: 15000 });

      const msgId = textRes.data?.result?.message_id;
      const cleanChannel = channelId.replace('@', '');
      return {
        success: true,
        channel: 'telegram',
        publisherName: this.name,
        externalPostId: String(msgId),
        externalPostUrl: `https://t.me/${cleanChannel}/${msgId}`,
      };
    } catch (err: any) {
      const errorMsg = err.response?.data?.description || err.message || 'Telegram publishing failed';
      return {
        success: false,
        channel: 'telegram',
        publisherName: this.name,
        error: errorMsg,
      };
    }
  }
}

