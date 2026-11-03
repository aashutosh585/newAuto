import axios from 'axios';
import { CollectorInterface, RawItem, RunContext, createSha256 } from '@social-engine/core';

export class DinoMateCollector implements CollectorInterface {
  name = 'dinomate';

  async collect(context: RunContext): Promise<RawItem[]> {
    const feedUrl = process.env.DINOMATE_DB_URL;
    if (!feedUrl) {
      await context.logger.debug('[DinoMateCollector] DINOMATE_DB_URL not set, skipping DinoMate source');
      return [];
    }

    await context.logger.info(`[DinoMateCollector] Querying DinoMate job feed`);
    try {
      const response = await axios.get(feedUrl, { timeout: 15000 });
      const records = response.data?.jobs || response.data || [];

      if (!Array.isArray(records)) {
        return [];
      }

      const items: RawItem[] = [];
      for (const item of records) {
        const company = item.company || 'Unknown';
        const title = item.title || 'Software Engineer';
        const location = item.location || 'India';
        const dedupeHash = createSha256(`${company}_${title}_${location}`);

        items.push({
          source: 'dinomate',
          externalId: item.id ? String(item.id) : undefined,
          externalUrl: item.apply_url || item.url,
          publishedAt: item.created_at ? new Date(item.created_at) : new Date(),
          dedupeHash,
          rawData: item,
        });
      }

      await context.logger.info(`[DinoMateCollector] Fetched ${items.length} jobs from DinoMate`);
      return items;
    } catch (err: any) {
      await context.logger.warn(`[DinoMateCollector] Failed to fetch DinoMate feed: ${err.message}`);
      return [];
    }
  }
}

