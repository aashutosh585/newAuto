import axios from 'axios';
import { CollectorInterface, RawItem, RunContext, createSha256 } from '@social-engine/core';

export class JobSpyCollector implements CollectorInterface {
  name = 'jobspy';

  async collect(context: RunContext): Promise<RawItem[]> {
    const jobspyUrl = process.env.JOBSPY_SERVICE_URL || 'http://jobspy-service:8000';
    await context.logger.info(`[JobSpyCollector] Querying JobSpy microservice at ${jobspyUrl}`);

    const queries = [
      { search_term: 'Software Engineer Fresher', location: 'India' },
      { search_term: 'Graduate Trainee Engineer', location: 'India' },
      { search_term: 'Junior Developer Intern', location: 'Remote' },
    ];

    const results: RawItem[] = [];

    for (const query of queries) {
      try {
        const response = await axios.post(
          `${jobspyUrl.replace(/\/+$/, '')}/search`,
          {
            site_names: ['indeed', 'linkedin', 'glassdoor'],
            search_term: query.search_term,
            location: query.location,
            results_wanted: 10,
            hours_old: 48,
          },
          { timeout: 35000 }
        );

        if (response.data?.success && Array.isArray(response.data?.jobs)) {
          for (const job of response.data.jobs) {
            const company = job.company || 'Unknown';
            const title = job.title || 'Unknown';
            const location = job.location || query.location;
            const dedupeHash = createSha256(`${company}_${title}_${location}`);

            results.push({
              source: 'jobspy',
              externalId: job.id,
              externalUrl: job.job_url,
              publishedAt: job.date_posted ? new Date(job.date_posted) : new Date(),
              dedupeHash,
              rawData: {
                title,
                company,
                location,
                description: job.description,
                isRemote: job.is_remote,
                salary: job.min_amount ? `${job.currency || 'INR'} ${job.min_amount} - ${job.max_amount}` : undefined,
              },
            });
          }
        }
      } catch (err: any) {
        await context.logger.warn(`[JobSpyCollector] Failed search for "${query.search_term}": ${err.message}`);
      }
    }

    await context.logger.info(`[JobSpyCollector] Collected ${results.length} raw jobs`);
    return results;
  }
}
