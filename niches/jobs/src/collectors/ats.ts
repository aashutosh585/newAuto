import axios from 'axios';
import { CollectorInterface, RawItem, RunContext, createSha256 } from '@social-engine/core';

export class ATSCollector implements CollectorInterface {
  name = 'ats_public_feeds';

  private greenhouseBoards = [
    'canonical',
    'cloudflare',
    'discord',
    'gitlab',
    'stripe',
    'postman',
    'razorpay',
  ];

  private leverCompanies = [
    'palantir',
    'figma',
    'netflix',
    'deliveroo',
  ];

  async collect(context: RunContext): Promise<RawItem[]> {
    await context.logger.info('[ATSCollector] Fetching public ATS feeds (Greenhouse & Lever)');
    const items: RawItem[] = [];

    // 1. Fetch Greenhouse Public Boards
    for (const board of this.greenhouseBoards) {
      try {
        const res = await axios.get(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs`, {
          timeout: 10000,
        });
        const jobs = res.data?.jobs || [];
        for (const job of jobs) {
          const title = job.title || '';
          const location = job.location?.name || 'Various';
          const company = board.toUpperCase();
          const dedupeHash = createSha256(`${company}_${title}_${location}`);

          items.push({
            source: `greenhouse_${board}`,
            externalId: String(job.id),
            externalUrl: job.absolute_url,
            publishedAt: job.updated_at ? new Date(job.updated_at) : new Date(),
            dedupeHash,
            rawData: {
              title,
              company,
              location,
              departments: job.departments?.map((d: any) => d.name) || [],
              absoluteUrl: job.absolute_url,
            },
          });
        }
      } catch (err: any) {
        // Continue quietly on single board timeout/404
      }
    }

    // 2. Fetch Lever Public Postings
    for (const company of this.leverCompanies) {
      try {
        const res = await axios.get(`https://api.lever.co/v0/postings/${company}?mode=json`, {
          timeout: 10000,
        });
        const postings = Array.isArray(res.data) ? res.data : [];
        for (const post of postings) {
          const title = post.text || '';
          const location = post.categories?.location || 'Remote';
          const dedupeHash = createSha256(`${company}_${title}_${location}`);

          items.push({
            source: `lever_${company}`,
            externalId: post.id,
            externalUrl: post.hostedUrl || post.applyUrl,
            publishedAt: post.createdAt ? new Date(post.createdAt) : new Date(),
            dedupeHash,
            rawData: {
              title,
              company: company.toUpperCase(),
              location,
              commitment: post.categories?.commitment,
              team: post.categories?.team,
              description: post.descriptionPlain?.slice(0, 2000),
              hostedUrl: post.hostedUrl,
            },
          });
        }
      } catch (err: any) {
        // Continue quietly on single company error
      }
    }

    await context.logger.info(`[ATSCollector] Scanned ATS boards and found ${items.length} candidate postings`);
    return items;
  }
}

