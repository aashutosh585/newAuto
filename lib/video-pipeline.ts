import connectToDatabase from './mongodb';
import Run, { IStage } from '../models/Run';
import Post from '../models/Post';
import Asset from '../models/Asset';
import { executeLLM } from './litellm';
import { publishToZernio, listConnectedAccounts } from './zernio';
import axios from 'axios';

export interface VideoReelPlan {
  role: string;
  batch: string;
  degrees: string;
  skills: string[];
  salary: string;
  companies: string;
  scriptHook: string;
  scriptValue: string;
  scriptCta: string;
  caption: string;
}

/**
 * Builds vertical 1080x1920 reel slide frame URLs
 */
export function buildReelFrameUrls(baseUrl: string, plan: VideoReelPlan): string[] {
  const base = baseUrl.replace(/\/+$/, '');
  const scenes = ['hook', 'eligibility', 'skills', 'salary', 'cta'];

  return scenes.map((scene) => {
    const params = new URLSearchParams({
      scene,
      role: plan.role,
      batch: plan.batch,
      degrees: plan.degrees,
      skills: (plan.skills || []).slice(0, 5).join(','),
      salary: plan.salary,
      companies: plan.companies,
    });
    return `${base}/api/og/reel?${params.toString()}`;
  });
}

/**
 * Executes the 2-3 Day Job Role Explainer Video Pipeline
 */
export async function runVideoReelPipeline(runId: string, slot: string): Promise<void> {
  await connectToDatabase();

  const run = await Run.findById(runId);
  if (!run) {
    console.error(`[VideoPipeline] Run ${runId} not found`);
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
    // STAGE 1: ROLE RESEARCH (COLLECT)
    // ========================================================
    console.log(`[VideoPipeline] Stage 1: ROLE RESEARCH`);
    const stageResearch: IStage = {
      name: 'collect',
      status: 'running',
      startedAt: new Date(),
      itemsIn: 1,
      itemsOut: 0,
    };

    // Fetch fresh job titles from DinoMate API
    let sampleRoles = [
      'Software Engineer Fresher',
      'Frontend React Developer',
      'Backend Node.js Developer',
      'Data Analyst Intern',
      'QA Automation Engineer',
      'DevOps Trainee Engineer',
    ];

    try {
      const DINOMATE_KEY = process.env.DINOMATE_API_KEY || 'publickey';
      const dinoRes = await axios.get('https://dinomate.app/api/public/jobs', {
        params: { q: 'developer fresher', limit: 8, experienceLevel: 'ENTRY' },
        headers: { 'x-api-key': DINOMATE_KEY },
        timeout: 10000,
      });
      const dinoJobs = dinoRes.data?.data || [];
      if (dinoJobs.length > 0) {
        sampleRoles = dinoJobs.map((j: any) => `${j.title} at ${j.company}`);
      }
    } catch {}

    stageResearch.status = 'completed';
    stageResearch.itemsOut = sampleRoles.length;
    stageResearch.completedAt = new Date();
    run.stages.push(stageResearch);
    await run.save();

    // ========================================================
    // STAGE 2: AI SCRIPT GENERATION
    // ========================================================
    console.log(`[VideoPipeline] Stage 2: SCRIPT GENERATION`);
    const stageScript: IStage = {
      name: 'write',
      status: 'running',
      startedAt: new Date(),
      itemsIn: sampleRoles.length,
      itemsOut: 1,
    };

    let plan: VideoReelPlan;

    try {
      const scriptResponse = await executeLLM<{
        role: string;
        batch: string;
        degrees: string;
        skills: string[];
        salary: string;
        companies: string;
        scriptHook: string;
        scriptValue: string;
        scriptCta: string;
        caption: string;
      }>({
        alias: 'writer',
        jsonMode: true,
        runId,
        messages: [
          {
            role: 'system',
            content: `You are an expert tech career creator crafting a 45-second viral YouTube Short & Instagram Reel explaining a tech job role for freshers in India.
Return strict JSON with this exact schema:
{
  "role": "Software Development Engineer Fresher",
  "batch": "2024 / 2025 / 2026 Graduates",
  "degrees": "B.Tech / BE (All Branches), BCA, MCA, BSc CS",
  "skills": ["JavaScript / Python", "Data Structures", "SQL & Databases", "React / Node", "Git"],
  "salary": "₹5 LPA - ₹14 LPA",
  "companies": "Amazon, TCS Digital, Accurics, Top Indian Startups",
  "scriptHook": "Stop scrolling if you're targeting a Software Engineer role in 2025! Here is what they don't tell you about who can actually apply.",
  "scriptValue": "First, you don't need a CS degree—BCA, MCA, and non-CS grads can apply if you know these 3 skills: clean coding, basic DSA, and 2 strong live projects.",
  "scriptCta": "Comment 'APPLY' below and follow DinoMate for the complete roadmap and active apply links!",
  "caption": "Viral caption with hashtags and clear call to action"
}`,
          },
          {
            role: 'user',
            content: `Create a job role explainer for one of these active roles:\n${sampleRoles.slice(0, 5).join('\n')}`,
          },
        ],
      });

      const d = scriptResponse.data;
      if (d && d.role) {
        plan = {
          role: d.role,
          batch: d.batch || '2024 - 2026 Graduates',
          degrees: d.degrees || 'B.Tech / BCA / MCA / BSc',
          skills: d.skills || ['JavaScript', 'DSA', 'SQL', 'Git'],
          salary: d.salary || '₹4.5 - ₹12 LPA',
          companies: d.companies || 'Tech Startups & MNCs',
          scriptHook: d.scriptHook || 'Want to crack this role?',
          scriptValue: d.scriptValue || 'Here are the key eligibility requirements...',
          scriptCta: d.scriptCta || 'Comment APPLY for direct links!',
          caption:
            d.caption ||
            `🎬 What does a ${d.role} actually do?\n\n🎓 Eligible: ${d.batch} (${d.degrees})\n💰 Expected CTC: ${d.salary}\n🛠️ Skills: ${(d.skills || []).join(', ')}\n\n💬 Comment "APPLY" to get active hiring links!\n🔔 Follow @dinomate for daily job drops\n\n#freshers #softwarejobs #hiring #reels #careers`,
        };
      } else {
        throw new Error('LLM did not return complete JSON structure');
      }
    } catch (err: any) {
      console.warn('[VideoPipeline] Falling back to default role explainer:', err.message);
      plan = {
        role: 'Software Development Engineer (SDE-1)',
        batch: '2024 / 2025 / 2026 Batches',
        degrees: 'B.Tech, BE, BCA, MCA, BSc IT',
        skills: ['Data Structures & Algorithms', 'JavaScript / Python', 'SQL', 'Git & GitHub'],
        salary: '₹5 LPA - ₹14 LPA',
        companies: 'Product Firms, FinTechs & Startups',
        scriptHook: 'Stop scrolling! Here is everything you need to know to crack an SDE-1 role as a fresher in 2025.',
        scriptValue: 'Companies are hiring right now. Freshers with 2 deployed projects and fundamental DSA are getting shortlisted.',
        scriptCta: 'Comment APPLY for verified job links!',
        caption: `🎬 Software Engineer Fresher Guide 2025-2026!\n\nWho is eligible?\n🎓 Batches: 2024 / 2025 / 2026\n📚 Degrees: B.Tech, BCA, MCA, BSc\n💰 Package: ₹5 LPA - ₹14 LPA\n\n💬 Comment "APPLY" for active links sent to your DM!\n🔔 Follow @dinomate for daily verified fresher jobs\n\n#fresherjobs #softwareengineer #techcareers #hiringfreshers #dinomate`,
      };
    }

    stageScript.status = 'completed';
    stageScript.completedAt = new Date();
    run.stages.push(stageScript);
    await run.save();

    // ========================================================
    // STAGE 3: RENDER VERTICAL REEL FRAMES (9:16)
    // ========================================================
    console.log(`[VideoPipeline] Stage 3: RENDER 9:16 FRAMES`);
    const stageRender: IStage = {
      name: 'render',
      status: 'running',
      startedAt: new Date(),
      itemsIn: 5,
      itemsOut: 0,
    };

    const reelFrameUrls = buildReelFrameUrls(baseUrl, plan);

    // Save vertical assets to MongoDB
    for (let i = 0; i < reelFrameUrls.length; i++) {
      try {
        await Asset.create({
          runId,
          type: 'video',
          url: reelFrameUrls[i],
          slideIndex: i,
          width: 1080,
          height: 1920,
          label: `reel_scene_${i + 1}_${plan.role.replace(/[^a-zA-Z0-9]/g, '_')}`,
          generatedAt: new Date(),
        });
      } catch {}
    }

    stageRender.status = 'completed';
    stageRender.itemsOut = reelFrameUrls.length;
    stageRender.completedAt = new Date();
    run.stages.push(stageRender);
    await run.save();

    // ========================================================
    // STAGE 4: PUBLISH VIA ZERNIO (YOUTUBE SHORTS & REELS)
    // ========================================================
    console.log(`[VideoPipeline] Stage 4: PUBLISH VIA ZERNIO`);
    const stagePublish: IStage = {
      name: 'publish',
      status: 'running',
      startedAt: new Date(),
      itemsIn: 1,
      itemsOut: 0,
    };

    try {
      // Publish the vertical reel cards or video media to Zernio
      const publishResult = await publishToZernio({
        content: plan.caption,
        mediaUrls: reelFrameUrls,
        mediaType: 'image', // Zernio distributes carousel/multi-frame media across platforms
        publishNow: true,
      });

      console.log('[VideoPipeline] Zernio publish result:', publishResult);

      const accounts = await listConnectedAccounts();
      for (const acc of accounts) {
        await Post.create({
          runId,
          platform: acc.platform || acc.type,
          externalPostId: publishResult?._id || publishResult?.id,
          postUrl: publishResult?.url,
          caption: plan.caption,
          status: 'published',
        }).catch(() => null);
      }

      stagePublish.status = 'completed';
      stagePublish.itemsOut = accounts.length || 1;
      stagePublish.completedAt = new Date();
      run.stages.push(stagePublish);
      run.postsPublished = accounts.length || 1;
    } catch (pubErr: any) {
      console.error('[VideoPipeline] Publish error:', pubErr.message);
      stagePublish.status = 'failed';
      stagePublish.errorMessage = pubErr.message;
      stagePublish.completedAt = new Date();
      run.stages.push(stagePublish);
    }

    run.status = 'completed';
    run.completedAt = new Date();
    await run.save();
    console.log(`[VideoPipeline] Run ${runId} COMPLETED ✓`);
  } catch (err: any) {
    console.error(`[VideoPipeline] Run ${runId} FAILED:`, err);
    run.status = 'failed';
    run.errorMessage = err.message || 'Video pipeline execution failed';
    run.completedAt = new Date();
    await run.save();
  }
}

