import crypto from 'crypto';
import axios from 'axios';
import connectToDatabase from './mongodb';
import Run, { IStage } from '../models/Run';
import JobItem from '../models/JobItem';
import Post from '../models/Post';
import Asset from '../models/Asset';
import { executeLLM } from './litellm';
import { publishToZernio, listConnectedAccounts } from './zernio';
import { runVideoReelPipeline } from './video-pipeline';

export function createSha256(str: string): string {
  return crypto.createHash('sha256').update(str.trim().toLowerCase()).digest('hex');
}

export function generateIdempotencyKey(slot: string, date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const slotClean = slot.trim().toLowerCase().replace(/[^a-z0-9_:-]/g, '_');
  return `run-${slotClean}-${yyyy}-${mm}-${dd}`;
}

const FRESHER_KEYWORDS = [
  'fresher', 'intern', 'internship', 'graduate', 'entry level', 'entry-level',
  'junior', 'trainee', 'associate', 'campus', '0-1', '0-2', 'new grad',
  '2024', '2025', '2026',
];

const SENIOR_EXCLUSIONS = [
  'senior', 'sr.', 'lead', 'staff', 'principal', 'manager', 'director',
  'head of', 'architect', '5+ years', '6+ years', '7+ years', '8+ years', '10+ years',
];

export async function checkUrlLiveness(url: string, timeoutMs = 6000): Promise<boolean> {
  try {
    const res = await axios.head(url, {
      timeout: timeoutMs,
      maxRedirects: 4,
      validateStatus: (s) => s < 400,
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0' },
    });
    return res.status < 400;
  } catch {
    try {
      const r = await axios.get(url, {
        timeout: timeoutMs,
        maxRedirects: 4,
        validateStatus: (s) => s < 400,
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0' },
      });
      return r.status < 400;
    } catch {
      return false;
    }
  }
}

/** Build carousel slide URLs for a list of ranked jobs */
function buildCarouselUrls(
  baseUrl: string,
  jobs: Array<{ company: string; role: string; location: string; batch: string; skills: string[]; workMode: string }>
): string[] {
  const base = baseUrl.replace(/\/+$/, '');
  const urls: string[] = [];

  // Slide 0: Cover
  urls.push(
    `${base}/api/og/carousel?slide=cover&count=${jobs.length}`
  );

  // Slides 1..N: One per job
  jobs.forEach((job, i) => {
    const params = new URLSearchParams({
      slide: 'job',
      index: String(i + 1),
      total: String(jobs.length),
      company: job.company,
      role: job.role,
      location: job.location,
      batch: job.batch,
      skills: (job.skills || []).slice(0, 4).join(','),
      workMode: job.workMode || 'REMOTE',
    });
    urls.push(`${base}/api/og/carousel?${params.toString()}`);
  });

  // Last slide: CTA / brand
  urls.push(`${base}/api/og/carousel?slide=cta`);

  return urls;
}

// ============================================================
// MAIN PIPELINE ENTRY
// ============================================================
export async function runSocialPipeline(
  runId: string,
  slot: string,
  pipelineType: 'image' | 'video' | 'all' | string = 'image'
): Promise<void> {
  // If video reel requested, delegate directly to video reel pipeline
  if (pipelineType === 'video') {
    return await runVideoReelPipeline(runId, slot);
  }

  await connectToDatabase();

  const run = await Run.findById(runId);
  if (!run) {
    console.error(`[Pipeline] Run ${runId} not found`);
    return;
  }

  run.status = 'running';
  run.startedAt = new Date();
  await run.save();

  const baseUrl =
    process.env.BASE_PUBLIC_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000';

  try {
    // ========================================================
    // STAGE 1: COLLECT
    // ========================================================
    console.log(`[Pipeline:${pipelineType}] Stage COLLECT — runId=${runId}`);
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
      skills?: string[];
      workMode?: string;
    }> = [];

    // ---- DinoMate (primary) ----
    const DINOMATE_KEY = process.env.DINOMATE_API_KEY || 'publickey';
    const dinomateQueries = [
      'software engineer',
      'frontend developer',
      'backend developer',
      'intern developer',
      'graduate trainee',
    ];
    for (const q of dinomateQueries) {
      try {
        const res = await axios.get('https://dinomate.app/api/public/jobs', {
          params: { q, limit: 10, experienceLevel: 'ENTRY', page: 1 },
          headers: { 'x-api-key': DINOMATE_KEY },
          timeout: 12000,
          maxRedirects: 5,
        });
        const jobs: any[] = res.data?.data || [];
        for (const j of jobs) {
          if (!j.link || !j.title || !j.company) continue;
          rawCandidates.push({
            title: j.title,
            company: j.company,
            location: j.location || j.city || 'India',
            applyUrl: j.link,
            source: `dinomate_${(j.source || 'api').toLowerCase()}`,
            publishedAt: j.publishedAt ? new Date(j.publishedAt) : new Date(),
            skills: [...(j.skills || []), ...(j.techStack || [])],
            workMode: j.workMode || 'REMOTE',
          });
        }
      } catch (e: any) {
        console.warn(`[Pipeline] DinoMate query "${q}" failed: ${e.message}`);
      }
    }

    // ---- Greenhouse ----
    const greenhouseBoards = ['canonical', 'cloudflare', 'discord', 'gitlab', 'stripe'];
    for (const board of greenhouseBoards) {
      try {
        const res = await axios.get(
          `https://boards-api.greenhouse.io/v1/boards/${board}/jobs`,
          { timeout: 8000 }
        );
        for (const j of res.data?.jobs || []) {
          rawCandidates.push({
            title: j.title || 'Software Engineer',
            company: board.charAt(0).toUpperCase() + board.slice(1),
            location: j.location?.name || 'Remote / India',
            applyUrl: j.absolute_url,
            source: `greenhouse_${board}`,
            publishedAt: j.updated_at ? new Date(j.updated_at) : new Date(),
          });
        }
      } catch {}
    }

    // ---- Lever ----
    const leverCompanies = ['palantir', 'figma', 'netflix'];
    for (const company of leverCompanies) {
      try {
        const res = await axios.get(
          `https://api.lever.co/v0/postings/${company}?mode=json`,
          { timeout: 8000 }
        );
        for (const p of Array.isArray(res.data) ? res.data : []) {
          rawCandidates.push({
            title: p.text || 'Developer',
            company: company.charAt(0).toUpperCase() + company.slice(1),
            location: p.categories?.location || 'Remote',
            applyUrl: p.hostedUrl || p.applyUrl,
            source: `lever_${company}`,
            publishedAt: p.createdAt ? new Date(p.createdAt) : new Date(),
          });
        }
      } catch {}
    }

    // ---- Filter + Dedupe ----
    const qualifiedItems: typeof rawCandidates = [];
    const fortyEightH = 48 * 60 * 60 * 1000;

    for (const c of rawCandidates) {
      const dedupeHash = createSha256(`${c.company}_${c.title}_${c.location}`);
      const titleLower = c.title.toLowerCase();
      let isEligible = true;
      let dropReason: string | undefined;

      if (c.publishedAt && Date.now() - c.publishedAt.getTime() > fortyEightH) {
        isEligible = false;
        dropReason = '>48h old';
      }
      if (isEligible && SENIOR_EXCLUSIONS.some((x) => titleLower.includes(x))) {
        isEligible = false;
        dropReason = 'Senior / Lead role';
      }
      // Fresher keyword check — bypass for DinoMate (already ENTRY level filtered)
      if (isEligible && !c.source.startsWith('dinomate') && !FRESHER_KEYWORDS.some((kw) => titleLower.includes(kw))) {
        isEligible = false;
        dropReason = 'Not fresher role';
      }
      if (isEligible && (!c.applyUrl || !c.applyUrl.startsWith('http'))) {
        isEligible = false;
        dropReason = 'Missing apply link';
      }

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
      } catch {}

      if (isEligible) qualifiedItems.push(c);
    }

    stageCollect.status = 'completed';
    stageCollect.itemsIn = rawCandidates.length;
    stageCollect.itemsOut = qualifiedItems.length;
    stageCollect.completedAt = new Date();
    run.stages.push(stageCollect);
    run.itemsFound = rawCandidates.length;
    run.itemsPassed = qualifiedItems.length;
    await run.save();

    // ========================================================
    // STAGE 2: RANK
    // ========================================================
    console.log(`[Pipeline] Stage RANK — ${qualifiedItems.length} candidates`);
    const stageRank: IStage = {
      name: 'rank',
      status: 'running',
      startedAt: new Date(),
      itemsIn: qualifiedItems.length,
      itemsOut: 0,
    };

    let rankedJobs: Array<{
      company: string;
      role: string;
      batch: string;
      skills: string[];
      score: number;
      applyUrl: string;
      location: string;
      workMode: string;
    }> = [];

    if (qualifiedItems.length > 0) {
      try {
        const candidatePayload = qualifiedItems.slice(0, 20).map((q, idx) => ({
          id: idx,
          company: q.company,
          title: q.title,
          location: q.location,
          url: q.applyUrl,
          skills: q.skills || [],
        }));

        const rankResponse = await executeLLM({
          alias: 'fast',
          jsonMode: true,
          runId,
          messages: [
            {
              role: 'system',
              content: `You are an expert tech recruiter. Rank these fresher software job openings for a social media post targeting 2024-2026 graduates in India.
Return strict JSON:
{
  "ranked": [
    {
      "id": 0,
      "company": "Company Name",
      "role": "Role Title",
      "batch": "2024 / 2025 / 2026",
      "skills": ["Skill1", "Skill2", "Skill3"],
      "score": 85
    }
  ]
}
Pick top 5. Score 0-100. Prioritize: well-known companies, remote-friendly, clear entry-level.`,
            },
            {
              role: 'user',
              content: `Rate and rank these:\n${JSON.stringify(candidatePayload, null, 2)}`,
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
              skills: item.skills || original.skills || ['Coding'],
              score: item.score || 80,
              applyUrl: original.url,
              location: original.location,
              workMode: qualifiedItems[item.id]?.workMode || 'REMOTE',
            });
          }
        }
      } catch (err: any) {
        console.warn(`[Pipeline] LLM ranking fallback: ${err.message}`);
        rankedJobs = qualifiedItems.slice(0, 5).map((q) => ({
          company: q.company,
          role: q.title,
          batch: '2024 / 2025',
          skills: q.skills || ['Software Engineering'],
          score: 80,
          applyUrl: q.applyUrl,
          location: q.location,
          workMode: q.workMode || 'REMOTE',
        }));
      }
    }

    stageRank.status = 'completed';
    stageRank.itemsOut = rankedJobs.length;
    stageRank.completedAt = new Date();
    run.stages.push(stageRank);
    await run.save();

    if (rankedJobs.length === 0) {
      run.status = 'skipped';
      run.errorMessage = 'No verified fresher openings found today.';
      run.completedAt = new Date();
      await run.save();
      return;
    }

    // ========================================================
    // STAGE 3: WRITE CAPTIONS
    // ========================================================
    console.log(`[Pipeline] Stage WRITE`);
    const stageWrite: IStage = {
      name: 'write',
      status: 'running',
      startedAt: new Date(),
      itemsIn: rankedJobs.length,
      itemsOut: 1,
    };

    const dateToday = new Date().toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

    let caption = '';
    try {
      const writeResponse = await executeLLM({
        alias: 'writer',
        runId,
        messages: [
          {
            role: 'system',
            content: `You write viral tech job alert captions for Instagram and Telegram targeting Indian freshers (2024-2026 batch).
Rules:
- Start with a fire headline + ${dateToday}
- Emoji-rich bullet list: company → role → batch → location
- CTA: "Swipe for details ➡️ Comment JOBS for apply links 💬"
- End: "Follow @dinomate for daily freshers alerts 🔔"
- Max 300 words. High energy. No hashtags in body (add 5 at very end).`,
          },
          {
            role: 'user',
            content: `Top ${rankedJobs.length} fresher openings:\n${JSON.stringify(
              rankedJobs.slice(0, 5).map((j) => ({
                company: j.company,
                role: j.role,
                batch: j.batch,
                location: j.location,
              })),
              null,
              2
            )}`,
          },
        ],
      });
      caption = writeResponse.text.trim();
    } catch {
      caption = `🚨 TOP FRESHER JOBS — ${dateToday}\n\n${rankedJobs
        .slice(0, 5)
        .map(
          (j, i) =>
            `${['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i]} ${j.company}\n   ${j.role} | ${j.batch} | ${j.location}`
        )
        .join('\n\n')}\n\n➡️ Swipe for job details\n💬 Comment "JOBS" for apply links\n\n🔔 Follow @dinomate for daily fresher alerts\n\n#fresher #jobs #hiring #techJobs #freshers2024`;
    }

    stageWrite.status = 'completed';
    stageWrite.completedAt = new Date();
    run.stages.push(stageWrite);
    await run.save();

    // ========================================================
    // STAGE 4: RENDER IMAGES (CAROUSEL)
    // ========================================================
    console.log(`[Pipeline] Stage RENDER`);
    const stageRender: IStage = {
      name: 'render',
      status: 'running',
      startedAt: new Date(),
      itemsIn: rankedJobs.length,
      itemsOut: 0,
    };

    const carouselUrls = buildCarouselUrls(baseUrl, rankedJobs.slice(0, 5));

    // Log assets to MongoDB
    for (let i = 0; i < carouselUrls.length; i++) {
      try {
        await Asset.create({
          runId,
          type: 'image',
          url: carouselUrls[i],
          slideIndex: i,
          width: 1080,
          height: 1350,
          label: i === 0 ? 'cover_slide' : i === carouselUrls.length - 1 ? 'cta_slide' : `job_slide_${i}`,
          generatedAt: new Date(),
        });
      } catch {}
    }

    stageRender.status = 'completed';
    stageRender.itemsOut = carouselUrls.length;
    stageRender.completedAt = new Date();
    run.stages.push(stageRender);
    await run.save();

    // ========================================================
    // STAGE 5: PUBLISH VIA ZERNIO
    // ========================================================
    console.log(`[Pipeline] Stage PUBLISH via Zernio`);
    const stagePublish: IStage = {
      name: 'publish',
      status: 'running',
      startedAt: new Date(),
      itemsIn: 1,
      itemsOut: 0,
    };

    try {
      const publishResult = await publishToZernio({
        content: caption,
        mediaUrls: carouselUrls,
        publishNow: true,
      });

      console.log('[Pipeline] Zernio publish OK:', JSON.stringify(publishResult).slice(0, 200));

      const connectedAccounts = await listConnectedAccounts();
      const postPromises = connectedAccounts.map((acc: any) =>
        Post.create({
          runId,
          platform: acc.platform || acc.type,
          externalPostId: publishResult?._id || publishResult?.id,
          postUrl: publishResult?.url,
          caption,
          status: 'published',
        }).catch(() => null)
      );
      await Promise.all(postPromises);

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

      // Send Telegram alert
      const tok = process.env.ALERT_TELEGRAM_BOT_TOKEN;
      const chat = process.env.ALERT_CHAT_ID;
      if (tok && chat) {
        await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chat,
            text: `⚠️ Publish FAILED — runId: ${runId}\n${publishErr.message}`,
          }),
        }).catch(() => {});
      }
    }

    run.status = 'completed';
    run.completedAt = new Date();
    await run.save();
    console.log(`[Pipeline] Run ${runId} DONE ✓`);

    // If 'all' requested, run the video reel pipeline next
    if (pipelineType === 'all') {
      try {
        console.log(`[Pipeline] type=all: now triggering companion video reel pipeline...`);
        const videoRun = await Run.create({
          slot: `${slot}:video`,
          idempotencyKey: generateIdempotencyKey(`${slot}_video_companion`),
          status: 'pending',
          triggerSource: 'companion_all',
          stages: [],
        });
        await runVideoReelPipeline(videoRun._id.toString(), `${slot}:video`);
      } catch (companionErr: any) {
        console.error('[Pipeline] Companion video reel run error:', companionErr.message);
      }
    }
  } catch (err: any) {
    console.error(`[Pipeline] Run ${runId} FATAL:`, err);
    run.status = 'failed';
    run.errorMessage = err.message || 'Unexpected pipeline error';
    run.completedAt = new Date();
    await run.save();
  }
}
