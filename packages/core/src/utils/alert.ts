import axios from 'axios';
import { redactSensitive } from './redact.js';

export async function sendTelegramAlert(message: string, isError = false): Promise<boolean> {
  const token = process.env.ALERT_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const alertChatId = process.env.ALERT_CHAT_ID || process.env.TELEGRAM_ALERT_CHAT_ID;

  if (!token || !alertChatId) {
    console.warn('[Alert] ALERT_TELEGRAM_BOT_TOKEN or ALERT_CHAT_ID not configured, skipping alert.');
    return false;
  }

  const prefix = isError ? '🚨 *[ALERT - SOCIAL ENGINE]*' : 'ℹ️ *[SOCIAL ENGINE INFO]*';
  const sanitized = redactSensitive(message);
  const text = `${prefix}\n\n${sanitized}`;

  try {
    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: alertChatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      },
      { timeout: 10000 }
    );
    return true;
  } catch (err) {
    console.error('[Alert] Failed to send Telegram alert:', err instanceof Error ? err.message : err);
    return false;
  }
}
