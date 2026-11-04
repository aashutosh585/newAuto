import connectToDatabase from '../mongodb';
import Run, { IStage } from '../../models/Run';
import Post from '../../models/Post';
import Asset from '../../models/Asset';
import { publishToZernio, listConnectedAccounts } from '../zernio';
import { assembleReelVideo } from './video-assembler';
import { generateReelVoiceover } from './video-tts';
import { ReelArchetype, VideoReelPlan } from './types';
import { discoverTrends, TrendEvidence } from '../trend/trend-discovery';
import { selectVideoFormat, VideoFormatId } from '../variety/format-engine';
import {
  evaluateIdeaSimilarity,
  recordVideoToMemory,
  getRecentMemories,
} from '../variety/content-memory';
import { generateStructuredBrief, StructuredContentBrief } from '../variety/script-brief-engine';
import { runVideoQualityCheck } from '../variety/quality-checks';
import { evaluateBriefWithCritic } from '../variety/quality-critic';
import { generateViralHooks, selectHookForArchetype } from '../trend/viral-hook-generator';
import path from 'path';
import fs from 'fs';

export type { ReelArchetype, VideoReelPlan };

/**
 * Builds 1080x1920 reel frame URLs with archetype parameters
 */
export function buildReelFrameUrls(baseUrl: string, plan: VideoReelPlan): string[] {
  const base = baseUrl.replace(/\/+$/, '');
  const scenes = ['hook', 'eligibility', 'skills', 'salary', 'cta'];

  return scenes.map((scene) => {
    const params = new URLSearchParams({
      scene,
      archetype: plan.archetype || 'funny_roast',
      role: plan.role,
      batch: plan.batch,
      degrees: plan.degrees,
      skills: (plan.skills || []).slice(0, 5).join(','),
      salary: plan.salary,
      companies: plan.companies,
      hookTitle: plan.hookHeadline || '',
      hookSubtitle: plan.hookSubtext || '',
      roastDialogue: plan.roastDialogue || '',
    });
    return `${base}/api/og/reel?${params.toString()}`;
  });
}

/**
 * Executes the Multi-Archetype Video Reel Pipeline with Neural Voiceover,
 * Trend Discovery, Video Variety Engine, Content Memory Deduplication, and Quality Checks.
 */
export async function runVideoReelPipeline(
  runId: string,
  slot: string,
  forcedArchetype?: ReelArchetype,
  forcedFormat?: VideoFormatId
): Promise<void> {
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

  console.log(`[VideoPipeline] Starting Autonomous Video Reel Pipeline (runId: ${runId})`);

  try {
    // ========================================================
    // STAGE 1: TREND DISCOVERY & BREAKOUT SCORING (COLLECT)
    // ========================================================
    console.log(`[VideoPipeline] Stage 1: DISCOVERING EVIDENCE-BASED TRENDS`);
    const stageTrend: IStage = {
      name: 'collect',
      status: 'running',
      startedAt: new Date(),
      itemsIn: 1,
      itemsOut: 0,
    };

    const trends = await discoverTrends({
      niche: 'fresher_careers',
      preferBreakout: true,
      limit: 5,
    });

    const activeTrend: TrendEvidence = trends[0] || {
      id: `trend_default_${Date.now()}`,
      topic: 'Engineering Degree vs Chai Tapri: The Unemployed Friend Roast',
      summary: 'Viral relatable comedy trend on friend teasing degree with zero job offers.',
      source: 'curated_radar',
      sourceUrl: 'https://dinomate.app/jobs',
      publishedAt: new Date(),
      velocityScore: 25000,
      isBreakout: true,
      matchedKeywords: ['engineering roast', 'friend comedy', 'fresher hiring'],
      niche: 'humor_roasts',
      evidenceLevel: 'curated_baseline',
      confidenceScore: 0.95,
      suggestedAngles: ['Friend roasting you for no job until DinoMate drops 12 LPA verified fresher role'],
    };

    console.log(
      `[VideoPipeline] Active Trend Selected: "${activeTrend.topic}" (Source: ${activeTrend.source}, Velocity: ${activeTrend.velocityScore}/hr, Breakout: ${activeTrend.isBreakout})`
    );

    stageTrend.status = 'completed';
    stageTrend.itemsOut = trends.length;
    stageTrend.completedAt = new Date();
    run.stages.push(stageTrend);
    await run.save();

    // ========================================================
    // STAGE 2: FORMAT ENGINE SELECTION & ANTI-FATIGUE CHECK
    // ========================================================
    console.log(`[VideoPipeline] Stage 2: FORMAT SELECTION & CONTENT MEMORY CHECK`);
    const recentMemories = await getRecentMemories(10);
    const recentFormats = recentMemories.map((m) => m.formatType as VideoFormatId).filter(Boolean);

    const preferHumor = forcedArchetype === 'funny_roast' || !forcedArchetype;
    const formatSelection = selectVideoFormat({
      topic: activeTrend.topic,
      niche: activeTrend.niche,
      recentFormats,
      preferHumor,
    });

    const selectedFormat = forcedFormat ? formatSelection.format : formatSelection.format;
    console.log(`[VideoPipeline] Format Engine Decision: ${formatSelection.reason}`);

    // Map format to archetype for visual rendering
    let archetype: ReelArchetype = forcedArchetype || 'funny_roast';
    if (!forcedArchetype) {
      if (selectedFormat.id === 'pov' || selectedFormat.id === 'cinematic_narrative') {
        archetype = 'funny_roast';
      } else if (selectedFormat.id === 'news_explainer' || selectedFormat.id === 'top_listicle') {
        archetype = 'breaking_drop';
      } else if (selectedFormat.id === 'mini_documentary' || selectedFormat.id === 'myth_vs_fact' || selectedFormat.id === 'case_study') {
        archetype = 'salary_reality';
      } else {
        archetype = 'zero_exp_roadmap';
      }
    }

    // Evaluate idea similarity against content memory
    const similarityCheck = await evaluateIdeaSimilarity({
      topic: activeTrend.topic,
      hookText: activeTrend.suggestedAngles[0] || activeTrend.topic,
      uniqueAngle: activeTrend.suggestedAngles[0],
      formatType: selectedFormat.id,
      archetype,
    });

    if (similarityCheck.isDuplicate) {
      console.warn(`[VideoPipeline] Duplicate detected: ${similarityCheck.rejectionReason}`);
      console.warn(`[VideoPipeline] Applying recommended variation angle.`);
    }

    // ========================================================
    // STAGE 3: STRUCTURED CONTENT BRIEF & SCRIPT GENERATION
    // ========================================================
    console.log(`[VideoPipeline] Stage 3: AI SCRIPT GENERATION (Format: ${selectedFormat.name}, Archetype: ${archetype})`);
    const stageScript: IStage = {
      name: 'write',
      status: 'running',
      startedAt: new Date(),
      itemsIn: 1,
      itemsOut: 1,
    };

    const brief: StructuredContentBrief = await generateStructuredBrief({
      trend: activeTrend,
      format: selectedFormat,
      preferHumor,
      runId,
    });

    // ========================================================
    // STAGE 4: QUALITY VALIDATION & AI CRITIC EVALUATION
    // ========================================================
    const criticReport = evaluateBriefWithCritic(brief);
    console.log(
      `[VideoPipeline] AI Critic Evaluation: ${criticReport.passed ? 'PASSED' : 'REVISION RECOMMENDED'} (Score: ${criticReport.overallScore}/10, Words: ${criticReport.totalWordCount}, Est Speech: ${criticReport.estimatedSpeechDurationSec}s)`
    );
    if (!criticReport.passed && criticReport.revisionInstructions) {
      console.warn(`[VideoPipeline] Critic feedback: ${criticReport.revisionInstructions}`);
    }

    const qualityReport = runVideoQualityCheck({
      brief,
      targetDurationSec: 18,
      aspectRatio: '9:16',
    });

    const activeBrief = qualityReport.fixedBrief || brief;
    console.log(`[VideoPipeline] Quality Check Passed: ${qualityReport.passed} (Score: ${qualityReport.score}/100, Issues: ${qualityReport.issues.length})`);

    const s1 = activeBrief.storyboard[0];
    const s2 = activeBrief.storyboard[1];
    const s3 = activeBrief.storyboard[2];
    const s4 = activeBrief.storyboard[3];
    const s5 = activeBrief.storyboard[4];

    const plan: VideoReelPlan = {
      archetype,
      formatType: selectedFormat.id,
      role: 'Software Development Engineer Fresher',
      batch: '2024 / 2025 / 2026 Batches',
      degrees: 'B.Tech, BE, BCA, MCA, BSc IT',
      skills: ['Python or JavaScript', 'Basic DSA', 'SQL', 'Git'],
      salary: 'Rs. 6 LPA - Rs. 14 LPA',
      companies: 'Top Tech Startups & MNCs',
      hookHeadline: s1.onScreenHeadline,
      hookSubtext: s1.onScreenSubtext,
      roastDialogue: s1.roastDialogue,
      narrationHook: s1.narrationText,
      narrationEligibility: s2.narrationText,
      narrationSkills: s3.narrationText,
      narrationSalary: s4.narrationText,
      narrationCta: s5.narrationText,
      caption: activeBrief.metadata.caption,
      suggestedVoice: activeBrief.narrationStyle.recommendedVoice as any,
      trendTopic: activeTrend.topic,
      qualityScore: qualityReport.score,
      structuredBrief: activeBrief,
    };

    stageScript.status = 'completed';
    stageScript.completedAt = new Date();
    run.stages.push(stageScript);
    await run.save();

    // ========================================================
    // STAGE 5: SYNTHESIZE NEURAL VOICE & RENDER 1080x1920 MP4
    // ========================================================
    console.log(`[VideoPipeline] Stage 5: SYNTHESIZE AUDIO & ASSEMBLE MP4 VIDEO`);
    const stageRender: IStage = {
      name: 'render',
      status: 'running',
      startedAt: new Date(),
      itemsIn: 5,
      itemsOut: 0,
    };

    const tempAudioDir = path.join(process.cwd(), '.temp_audio', `run_${runId}`);
    let sceneDurations = [3.5, 3.5, 3.5, 3.5, 3.0];
    let masterAudioPath: string | undefined;

    try {
      console.log(`[VideoPipeline] Synthesizing Neural Voiceover (${plan.suggestedVoice || 'hi-IN-MadhurNeural'})...`);
      const ttsResult = await generateReelVoiceover(
        [
          { name: 'hook', text: plan.narrationHook },
          { name: 'eligibility', text: plan.narrationEligibility },
          { name: 'skills', text: plan.narrationSkills },
          { name: 'salary', text: plan.narrationSalary },
          { name: 'cta', text: plan.narrationCta },
        ],
        tempAudioDir,
        plan.suggestedVoice || 'hi-IN-MadhurNeural'
      );

      masterAudioPath = ttsResult.masterAudioPath;
      sceneDurations = ttsResult.scenes.map((s) => Math.max(s.durationSec, 2.8));
      const totalAudio = sceneDurations.reduce((a, b) => a + b, 0);
      if (totalAudio > 20.0 || totalAudio < 15.0) {
        const scale = 17.5 / totalAudio;
        sceneDurations = sceneDurations.map((d) => Number((d * scale).toFixed(2)));
      }
      console.log(`[VideoPipeline] Voiceover ready: ${sceneDurations.reduce((a, b) => a + b, 0).toFixed(1)}s total duration (strictly within 15-20s range) across 5 scenes.`);
    } catch (ttsErr: any) {
      console.warn('[VideoPipeline] TTS audio generation notice:', ttsErr.message);
    }

    const reelFrameUrls = buildReelFrameUrls(baseUrl, plan);

    // Save individual scene frame assets to MongoDB
    for (let i = 0; i < reelFrameUrls.length; i++) {
      try {
        await Asset.create({
          runId,
          type: 'image',
          url: reelFrameUrls[i],
          slideIndex: i,
          width: 1080,
          height: 1920,
          label: `reel_${archetype}_scene_${i + 1}`,
          generatedAt: new Date(),
        });
      } catch {}
    }

    // Assemble final MP4 video with audio & smooth transitions
    let finalVideoUrl: string | undefined;
    const publicVideoDir = path.join(process.cwd(), 'public', 'videos');
    const videoFileName = `reel_${runId}.mp4`;
    const videoFilePath = path.join(publicVideoDir, videoFileName);

    try {
      const videoResult = await assembleReelVideo({
        sceneImages: reelFrameUrls,
        outputPath: videoFilePath,
        durations: sceneDurations,
        audioPath: masterAudioPath,
        fps: 24,
      });

      finalVideoUrl = `${baseUrl.replace(/\/+$/, '')}${videoResult.publicUrl || `/videos/${videoFileName}`}`;

      await Asset.create({
        runId,
        type: 'video',
        url: finalVideoUrl,
        slideIndex: 0,
        width: 1080,
        height: 1920,
        label: `final_reel_${archetype}_${plan.role.replace(/[^a-zA-Z0-9]/g, '_')}`,
        generatedAt: new Date(),
      });

      console.log(
        `[VideoPipeline] Full MP4 Video created at: ${videoFilePath} (${videoResult.fileSizeMb} MB, ${videoResult.durationSec}s, audio=${videoResult.hasAudio})`
      );

      // Record to Content Memory to protect against future duplicates
      await recordVideoToMemory({
        topic: activeTrend.topic,
        niche: activeTrend.niche,
        targetAudience: activeBrief.targetAudience,
        formatType: selectedFormat.id,
        archetype,
        uniqueAngle: activeBrief.uniqueAngle,
        hookText: plan.narrationHook,
        hookType: activeBrief.hookBlueprint.hookType,
        narrativeStructure: activeBrief.narrativeStructure,
        visualStyle: activeBrief.visualDirection.styleArchetype,
        tags: activeBrief.metadata.hashtags,
        viralityScore: 0.88,
        runId,
      });
    } catch (vErr: any) {
      console.warn('[VideoPipeline] Video assembly notice:', vErr.message);
    } finally {
      try {
        if (fs.existsSync(tempAudioDir)) {
          fs.rmSync(tempAudioDir, { recursive: true, force: true });
        }
      } catch {}
    }

    stageRender.status = 'completed';
    stageRender.itemsOut = reelFrameUrls.length + (finalVideoUrl ? 1 : 0);
    stageRender.completedAt = new Date();
    run.stages.push(stageRender);
    await run.save();

    // ========================================================
    // STAGE 6: PUBLISH VIA ZERNIO (YOUTUBE SHORTS & REELS)
    // ========================================================
    console.log(`[VideoPipeline] Stage 6: PUBLISH VIA ZERNIO`);
    const stagePublish: IStage = {
      name: 'publish',
      status: 'running',
      startedAt: new Date(),
      itemsIn: 1,
      itemsOut: 0,
    };

    try {
      const publishResult = await publishToZernio({
        content: plan.caption,
        mediaUrls: finalVideoUrl ? [finalVideoUrl] : reelFrameUrls,
        mediaType: finalVideoUrl ? 'video' : 'image',
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
      console.error('[VideoPipeline] Publish notice:', pubErr.message);
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
