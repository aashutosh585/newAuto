import {
  WriterInterface,
  RankedItemOutput,
  PostContent,
  StyleConfig,
  RunContext,
  llmClient,
} from '@social-engine/core';

interface LLMWriterResponse {
  headline: string;
  telegramCaption: string;
  instagramCaption: string;
  youtubeTitle: string;
  youtubeDescription: string;
  xPostText: string;
  tags: string[];
}

export class JobWriter implements WriterInterface {
  async writeCaptions(
    rankedItems: RankedItemOutput[],
    style: StyleConfig,
    context: RunContext
  ): Promise<PostContent> {
    await context.logger.info(`[JobWriter] Drafting platform captions for ${rankedItems.length} selected jobs`);

    const summaryItems = rankedItems.map((r, i) => ({
      no: i + 1,
      role: r.extractedData.role || r.extractedData.title,
      company: r.extractedData.company,
      batch: r.extractedData.batch,
      location: r.extractedData.location,
      url: r.extractedData.applyUrl,
    }));

    const dateToday = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const systemPrompt = `You are a viral social media manager for an elite early-career tech community.
Craft high-converting, platform-tailored copy for a multi-slide carousel of fresher software jobs.

CRITICAL RULES:
1. Every platform caption MUST be distinct and unique (Zernio rejects duplicate captions).
2. Telegram Caption: formatted with bold HTML, lists every company and role with clickable link format, and directs to apply now.
3. Instagram Caption: punchy hook line, summary of roles, strong Call-To-Action instructing followers to comment "JOBS" to receive all direct links in DM, relevant hashtags.
4. Hook formula to follow: "${style.hookFormula || 'Top Fresh Graduate Tech Openings Today'}".
5. Current Date: ${dateToday}.

Return strictly JSON matching:
{
  "headline": "Short hook headline (max 7 words)",
  "telegramCaption": "Full HTML formatted Telegram message",
  "instagramCaption": "Engaging Instagram post with CTA and hashtags",
  "youtubeTitle": "Catchy YouTube Shorts title under 70 chars",
  "youtubeDescription": "Shorts description with tags",
  "xPostText": "Concise X/Twitter thread hook under 260 chars",
  "tags": ["fresherjobs", "hiring", "softwareengineer", "techcareers"]
}`;

    const userPrompt = `Job Data:\n${JSON.stringify(summaryItems, null, 2)}`;

    try {
      const response = await llmClient.complete<LLMWriterResponse>({
        alias: 'writer',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        jsonMode: true,
        temperature: 0.3,
        runId: context.runId,
      });

      const data = response.data;
      if (data && data.telegramCaption && data.instagramCaption) {
        return {
          headline: data.headline || `${rankedItems.length} Fresh Tech Jobs Hiring Now`,
          telegramCaption: data.telegramCaption,
          instagramCaption: data.instagramCaption,
          youtubeTitle: data.youtubeTitle || `Top ${rankedItems.length} Fresher Jobs Hiring Today!`,
          youtubeDescription: data.youtubeDescription || 'Apply links in telegram!',
          xPostText: data.xPostText || `${rankedItems.length} new tech fresher openings dropped today! 🚀`,
          tags: Array.isArray(data.tags) ? data.tags : ['techjobs', 'fresherjobs'],
        };
      }
    } catch (err: any) {
      await context.logger.warn(`[JobWriter] LLM writer error: ${err.message}. Using built-in template fallback.`);
    }

    // Built-in fallback template ensuring clean output
    const fallbackJobList = rankedItems
      .slice(0, 5)
      .map((r, i) => `${i + 1}. <b>${r.extractedData.company}</b> - ${r.extractedData.role} (${r.extractedData.batch})\n🔗 <a href="${r.extractedData.applyUrl}">Apply Here</a>`)
      .join('\n\n');

    return {
      headline: `Top ${rankedItems.length} Fresher Jobs (${dateToday})`,
      telegramCaption: `🚀 <b>URGENT FRESHER HIRING ALERTS</b>\n📅 <i>${dateToday}</i>\n\n${fallbackJobList}\n\n👉 <i>Share with batchmates looking for opportunities!</i>`,
      instagramCaption: `⚡ ${rankedItems.length} Top Tech Companies are actively hiring freshers today (${dateToday})!\n\nFeatured:\n${rankedItems.slice(0, 4).map((r) => `▪ ${r.extractedData.company} - ${r.extractedData.role}`).join('\n')}\n\n💬 Comment "JOBS" below and we'll DM you the direct application links instantly!\n\n#fresherjobs #softwareengineer #techcareers #2025graduates #hiringnow`,
      youtubeTitle: `Top Tech Companies Hiring Freshers Today! 🚀`,
      youtubeDescription: `Daily verified job alerts for engineers. Check Telegram for direct links!`,
      xPostText: `🚨 Active hiring for 2024/2025/2026 graduates: ${rankedItems.slice(0, 3).map((r) => r.extractedData.company).join(', ')}. Details in thread.`,
      tags: ['fresherjobs', 'techhiring', 'campusplacements'],
    };
  }
}

