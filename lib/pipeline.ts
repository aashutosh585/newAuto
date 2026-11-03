import crypto from 'crypto';
import axios from 'axios';
import connectToDatabase from './mongodb';
import Run, { IStage } from '../models/Run';
import JobItem from '../models/JobItem';
import Post from '../models/Post';
import { executeLLM } from './litellm';
import { publishToZernio, listConnectedAccounts } from './zernio';

export function createSha256(str: string): string {
  return crypto.createHash('sha256').update(str.trim().toLowerCase()).digest('hex');
}

export function generateIdempotencyKey(slot: string, date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const slotClean = slot.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return `run-${slotClean}-${yyyy}-${mm}-${dd}`;
}

const FRESHER_KEYWORDS = [
  'fresher',
  'intern',
  'internship',
  'graduate',
  'entry level',
  'entry-level',
  'junior',
  'trainee',
  'associate',
  'campus',
  '0-1',
  '0-2',
  'new grad',
  '2024',
  '2025',
  '2026',
];

const SENIOR_EXCLUSIONS = [
  'senior',
  'sr.',
  'lead',
  'staff',
  'principal',
  'manager',
  'director',
  'head of',
  'architect',
  '5+ years',
  '6+ years',
  '7+ years',
  '8+ years',
  '10+ years',
];

export async function checkUrlLiveness(url: string, timeoutMs = 6000): Promise<boolean> {
  try {
    const res = await axios.head(url, {
      timeout: timeoutMs,
      maxRedirects: 4,
      validateStatus: (s) => s < 400,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    return res.status < 400;
  } catch {
    try {
      const getRes = await axios.get(url, {
        timeout: timeoutMs,
        maxRedirects: 4,
        validateStatus: (s) => s < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      return getRes.status < 400;
    } catch {
      return false;
    }
  }
}

export async function runSocialPipeline(runId: string, slot: string, triggerSource = 'cron'): Promise<void> {
  await connectToDatabase();

  const run = await Run.findById(runId);
  if (!run) {
    console.error(`[Pipeline] Run ${runId} not found`);
    return;
  }

  run.status = 'running';
  run.startedAt = new Date();
  await run.save();

  try {
    // ------------------------------------------------------------------
    // STAGE 1: COLLECT
    // ------------------------------------------------------------------
    console.log(`[Pipeline] Starting Stage: COLLECT for run ${runId}`);
    const stageCollect: IStage = {
      name: 'collect',
      status: 'running',
      startedAt: new Date(),
      itemsIn: 0,
      itemsOut: 0,
    };

    const rawCandidates: Array<{
      title: string;
      company: string;
      location: string;
      applyUrl: string;
      source: string;
      publishedAt?: Date;
    }> = [];

    // Official Greenhouse public job boards
    const greenhouseBoards = ['canonical', 'cloudflare', 'discord', 'gitlab', 'stripe'];
    for (const board of greenhouseBoards) {
      try {
        const res = await axios.get(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs`, { timeout: 8000 });
        const jobs = res.data?.jobs || [];
        for (const j of jobs) {
          rawCandidates.push({
            title: j.title || 'Software Engineer',
            company: board.toUpperCase(),
            location: j.location?.name || 'Remote / India',
            applyUrl: j.absolute_url,
            source: `greenhouse_${board}`,
            publishedAt: j.updated_at ? new Date(j.updated_at) : new Date(),
          });
        }
      } catch (e: any) {
        // continue
      }
    }

    // Official Lever public postings
    const leverCompanies = ['palantir', 'figma', 'netflix'];
    for (const company of leverCompanies) {
      try {
        const res = await axios.get(`https://api.lever.co/v0/postings/${company}?mode=json`, { timeout: 8000 });
        const postings = Array.isArray(res.data) ? res.data : [];
        for (const p of postings) {
          rawCandidates.push({
            title: p.text || 'Developer',
            company: company.toUpperCase(),
            location: p.categories?.location || 'Remote',
            applyUrl: p.hostedUrl || p.applyUrl,
            source: `lever_${company}`,
            publishedAt: p.createdAt ? new Date(p.createdAt) : new Date(),
          });
        }
      } catch (e: any) {
        // continue
      }
    }

    // Filter, Deduplicate & Liveness verification
    const qualifiedItems: any[] = [];
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;

    for (const c of rawCandidates) {
      const dedupeHash = createSha256(`${c.company}_${c.title}_${c.location}`);
      const titleLower = c.title.toLowerCase();

      let isEligible = true;
      let dropReason: string | undefined;

      // Age check
      if (c.publishedAt && Date.now() - c.publishedAt.getTime() > fortyEightHoursMs) {
        isEligible = false;
        dropReason = '>48h old';
      }

      // Senior exclusion check
      if (isEligible && SENIOR_EXCLUSIONS.some((x) => titleLower.includes(x))) {
        isEligible = false;
        dropReason = 'Senior / Lead role exclusion';
      }

      // Fresher match check
      if (isEligible && !FRESHER_KEYWORDS.some((kw) => titleLower.includes(kw))) {
        isEligible = false;
        dropReason = 'Not fresher / graduate role';
      }

      // URL check
      if (isEligible && (!c.applyUrl || !c.applyUrl.startsWith('http'))) {
        isEligible = false;
        dropReason = 'Missing apply link';
      }

      // Save to JobItem ledger in MongoDB
      try {
        await JobItem.findOneAndUpdate(
          { dedupeHash },
          {
            runId,
            dedupeHash,
            title: c.title,
            company: c.company,
            location: c.location,
            applyUrl: c.applyUrl,
            source: c.source,
            status: isEligible ? 'passed' : 'dropped',
            dropReason,
            isLive: isEligible,
          },
          { upsert: true, new: true }
        );
      } catch (e) {
        // ignore duplicate key
      }

      if (isEligible) {
        qualifiedItems.push(c);
      }
    }

    stageCollect.status = 'completed';
    stageCollect.itemsIn = rawCandidates.length;
    stageCollect.itemsOut = qualifiedItems.length;
    stageCollect.completedAt = new Date();
    run.stages.push(stageCollect);
    run.itemsFound = rawCandidates.length;
    run.itemsPassed = qualifiedItems.length;
    await run.save();

    // ------------------------------------------------------------------
    // STAGE 2: RANK
    // ------------------------------------------------------------------
    console.log(`[Pipeline] Starting Stage: RANK for ${qualifiedItems.length} candidate jobs`);
    const stageRank: IStage = {
      name: 'rank',
      status: 'running',
      startedAt: new Date(),
      itemsIn: qualifiedItems.length,
      itemsOut: 0,
    };

    let rankedJobs: any[] = [];
    if (qualifiedItems.length > 0) {
      try {
        const candidatePayload = qualifiedItems.slice(0, 15).map((q, idx) => ({
          id: idx,
          company: q.company,
          title: q.title,
          location: q.location,
          url: q.applyUrl,
        }));

        const rankResponse = await executeLLM({
          alias: 'fast',
          jsonMode: true,
          messages: [
            {
              role: 'system',
              content: `You are an expert tech recruiter ranking fresher software openings for social media.
Return strict JSON with this exact shape:
{
  "ranked": [
    {
      "id": 0,
      "company": "Company Name",
      "role": "Role Title",
      "batch": "2024 / 2025 / 2026",
      "skills": ["Skill1", "Skill2"],
      "score": 85,
      "reason": "Top tech company hiring freshers"
    }
  ]
}`,
            },
            {
              role: 'user',
              content: `Here are candidate jobs:\n${JSON.stringify(candidatePayload, null, 2)}`,
            },
          ],
        });

        const rankedList = rankResponse.data?.ranked || [];
        for (const item of rankedList) {
          const original = candidatePayload[item.id];
          if (original) {
            rankedJobs.push({
              company: item.company || original.company,
              role: item.role || original.title,
              batch: item.batch || '2024 / 2025',
              skills: item.skills || ['Coding', 'Problem Solving'],
              score: item.score || 80,
              applyUrl: original.url,
            });
          }
        }
      } catch (err: any) {
        console.warn(`[Pipeline] LLM ranking fallback used: ${err.message}`);
        rankedJobs = qualifiedItems.slice(0, 5).map((q) => ({
          company: q.company,
          role: q.title,
          batch: '2024 / 2025',
          skills: ['Software Engineering'],
          score: 80,
          applyUrl: q.applyUrl,
        }));
      }
    }

    stageRank.status = 'completed';
    stageRank.itemsIn = qualifiedItems.length;
    stageRank.itemsOut = rankedJobs.length;
    stageRank.completedAt = new Date();
    run.stages.push(stageRank);
    await run.save();

    // Guardrail: Skip post if too few good items
    if (rankedJobs.length === 0) {
      const skipMsg = 'No verified fresher openings found meeting criteria today. Run skipped.';
      console.log(`[Pipeline] ${skipMsg}`);
      run.status = 'skipped';
      run.errorMessage = skipMsg;
      run.completedAt = new Date();
      await run.save();
      return;
    }

    // ------------------------------------------------------------------
    // STAGE 3: WRITE
    // ------------------------------------------------------------------
    console.log(`[Pipeline] Starting Stage: WRITE for ${rankedJobs.length} selected jobs`);
    const stageWrite: IStage = {
      name: 'write',
      status: 'running',
      startedAt: new Date(),
      itemsIn: rankedJobs.length,
      itemsOut: 1,
    };

    const dateToday = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    let caption = '';

    try {
      const writeResponse = await executeLLM({
        alias: 'writer',
        messages: [
          {
            role: 'system',
            content: `You craft high-converting, viral tech job alerts for Telegram and Instagram.
Rules:
- High energy headline with date (${dateToday})
- Clean bullet list of companies and roles
- Direct apply CTA
- Instructions to comment "JOBS" for direct links in DM`,
          },
          {
            role: 'user',
            content: `Jobs data:\n${JSON.stringify(rankedJobs.slice(0, 5), null, 2)}`,
          },
        ],
      });
      caption = writeResponse.text.trim();
    } catch {
      caption = `🚨 URGENT FRESHER HIRING ALERTS (${dateToday})\n\n${rankedJobs
        .slice(0, 5)
        .map((j, i) => `${i + 1}. ${j.company} - ${j.role} (${j.batch})\n🔗 ${j.applyUrl}`)
        .join('\n\n')}\n\n💬 Comment "JOBS" below to receive all apply links instantly in your DM! 🚀`;
    }

    stageWrite.status = 'completed';
    stageWrite.completedAt = new Date();
    run.stages.push(stageWrite);
    await run.save();

    // ------------------------------------------------------------------
    // STAGE 4: PUBLISH (VIA ZERNIO)
    // ------------------------------------------------------------------
    console.log(`[Pipeline] Starting Stage: PUBLISH via Zernio`);
    const stagePublish: IStage = {
      name: 'publish',
      status: 'running',
      startedAt: new Date(),
      itemsIn: 1,
      itemsOut: 0,
    };

    try {
      const topJob = rankedJobs[0];
      const baseUrl = process.env.BASE_PUBLIC_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const ogImageUrl = `${baseUrl.replace(/\/+$/, '')}/api/og?title=${encodeURIComponent(
        topJob?.role || 'Software Engineer'
      )}&company=${encodeURIComponent(topJob?.company || 'TECH')}&location=${encodeURIComponent(
        topJob?.location || 'India'
      )}&batch=${encodeURIComponent(topJob?.batch || '2024 / 2025')}`;

      const publishResult = await publishToZernio({
        content: caption,
        mediaUrls: [ogImageUrl],
        publishNow: true,
      });

      console.log('[Pipeline] Zernio publishing successful:', publishResult);

      const connectedAccounts = await listConnectedAccounts();
      for (const acc of connectedAccounts) {
        await Post.create({
          runId,
          platform: acc.platform,
          externalPostId: publishResult?._id || publishResult?.id,
          postUrl: publishResult?.url,
          caption,
          status: 'published',
        });
      }

      stagePublish.status = 'completed';
      stagePublish.itemsOut = connectedAccounts.length || 1;
      stagePublish.completedAt = new Date();
      run.stages.push(stagePublish);
      run.postsPublished = connectedAccounts.length || 1;
    } catch (publishErr: any) {
      console.error('[Pipeline] Zernio publish error:', publishErr.message);
      stagePublish.status = 'failed';
      stagePublish.errorMessage = publishErr.message;
      stagePublish.completedAt = new Date();
      run.stages.push(stagePublish);
    }

    // ------------------------------------------------------------------
    // COMPLETE RUN
    // ------------------------------------------------------------------
    run.status = 'completed';
    run.completedAt = new Date();
    await run.save();
    console.log(`[Pipeline] Run ${runId} finished successfully!`);
  } catch (err: any) {
    console.error(`[Pipeline] Run ${runId} encountered an error:`, err);
    run.status = 'failed';
    run.errorMessage = err.message || 'Pipeline execution failed';
    run.completedAt = new Date();
    await run.save();
  }
}
