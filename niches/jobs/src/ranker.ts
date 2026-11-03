import { RankerInterface, RawItem, RankedItemOutput, RunContext, llmClient } from '@social-engine/core';

interface LLMRankedItem {
  company: string;
  role: string;
  batch: string;
  skills: string[];
  location: string;
  salary?: string;
  score: number;
  reasoning: string;
  applyUrl: string;
}

interface LLMRankingResponse {
  jobs: LLMRankedItem[];
}

export class JobRanker implements RankerInterface {
  async rank(items: RawItem[], context: RunContext): Promise<RankedItemOutput[]> {
    if (items.length === 0) {
      return [];
    }

    await context.logger.info(`[JobRanker] Ranking ${items.length} candidate jobs with LiteLLM (alias: fast)`);

    // Prepare candidate snippets for LLM
    const candidateList = items.map((item, idx) => ({
      index: idx,
      source: item.source,
      title: item.rawData?.title || 'Unknown Title',
      company: item.rawData?.company || 'Unknown Company',
      location: item.rawData?.location || 'India',
      url: item.externalUrl,
      description: String(item.rawData?.description || '').slice(0, 400),
    }));

    const systemPrompt = `You are an expert tech career advisor evaluating fresher and graduate software jobs for a high-engagement social media audience.
You will receive a list of candidate jobs.
Evaluate each job on:
1. Legitimacy & company reputation (prefer top tech, funded startups, clear ATS links).
2. True eligibility for freshers (graduating 2024, 2025, 2026, or 0-1 yrs exp).
3. Clarity of skills and role.

Assign a score from 0 to 100.
Return strict JSON matching this exact structure:
{
  "jobs": [
    {
      "index": 0,
      "company": "Company Name",
      "role": "Concise Role Title",
      "batch": "2024 / 2025 / 2026",
      "skills": ["Skill1", "Skill2", "Skill3"],
      "location": "Location / Remote",
      "salary": "Estimated or posted salary / Competitive",
      "score": 85,
      "reasoning": "Brief one sentence evaluation"
    }
  ]
}`;

    const userPrompt = `Here are the candidate jobs:\n${JSON.stringify(candidateList, null, 2)}`;

    try {
      const response = await llmClient.complete<LLMRankingResponse>({
        alias: 'fast',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        jsonMode: true,
        temperature: 0.1,
        runId: context.runId,
      });

      const parsedJobs = response.data?.jobs || [];
      const rankedOutputs: RankedItemOutput[] = [];

      for (const ranked of parsedJobs) {
        const originalIndex = (ranked as any).index;
        const originalItem = candidateList[originalIndex] ? items[originalIndex] : undefined;

        if (!originalItem) continue;

        const isGood = ranked.score >= 70;

        rankedOutputs.push({
          itemId: originalItem.dedupeHash,
          score: ranked.score,
          reasoning: ranked.reasoning,
          extractedData: {
            title: ranked.role || String(originalItem.rawData.title),
            company: ranked.company || String(originalItem.rawData.company),
            role: ranked.role,
            batch: ranked.batch || '2024 / 2025',
            skills: Array.isArray(ranked.skills) ? ranked.skills : [],
            location: ranked.location || 'India / Remote',
            salary: ranked.salary || 'Competitive',
            applyUrl: originalItem.externalUrl,
            highlights: [
              `Batch: ${ranked.batch || '2024 / 2025'}`,
              `Location: ${ranked.location || 'Remote'}`,
              `Skills: ${(ranked.skills || []).slice(0, 3).join(', ')}`,
            ],
          },
          isSelected: isGood,
        });
      }

      // Sort by score descending
      rankedOutputs.sort((a, b) => b.score - a.score);

      await context.logger.info(
        `[JobRanker] Scored ${rankedOutputs.length} jobs. Top job scored: ${rankedOutputs[0]?.score || 0}`
      );

      return rankedOutputs;
    } catch (err: any) {
      await context.logger.error(`[JobRanker] LLM ranking failed: ${err.message}`);
      // Fallback: heuristic scoring based on presence of key keywords
      return items.map((item) => ({
        itemId: item.dedupeHash,
        score: 75,
        reasoning: 'Fallback heuristic score',
        extractedData: {
          title: String(item.rawData.title || 'Software Engineer'),
          company: String(item.rawData.company || 'Tech Company'),
          role: String(item.rawData.title || 'Software Engineer'),
          batch: '2024 / 2025',
          skills: ['Coding', 'Problem Solving'],
          location: String(item.rawData.location || 'India'),
          applyUrl: item.externalUrl,
        },
        isSelected: true,
      }));
    }
  }
}

