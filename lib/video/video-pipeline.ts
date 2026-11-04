import connectToDatabase from '../mongodb';
import Run, { IStage } from '../../models/Run';
import Post from '../../models/Post';
import Asset from '../../models/Asset';
import { publishToZernio, listConnectedAccounts } from '../zernio';
import { ReelArchetype, VideoReelPlan } from './types';
import { discoverTrends } from '../trend/trend-discovery';
import { forgeFreshIdea, DeliveryMode, VideoIdea } from '../trend/idea-forge';
import { recordVideoToMemory } from '../variety/content-memory';
import { buildCast, CastMember } from './cast';
import { directScript, ReelScript } from './script-director';
import {
  synthesizeDialogue,
  scriptToVoiceLines,
  renderReel,
  fetchBroll,
  pickBackgroundMusic,
  RenderResult,
} from './reel-renderer';
import path from 'path';
import fs from 'fs';

export type { ReelArchetype, VideoReelPlan, DeliveryMode };

/** Legacy static-frame URL builder (still used by the OG preview route / old tests). */
export function buildReelFrameUrls(baseUrl: string, plan: VideoReelPlan): string[] {
  const base = baseUrl.replace(/\/+$/, '');
  return ['hook', 'eligibility', 'skills', 'salary', 'cta'].map((scene) => {
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

/** Accept new modes and legacy archetype names. */
export function resolveMode(input?: string): DeliveryMode | undefined {
  if (!input) return undefined;
  const m = input.toLowerCase();
  if (m === 'skit' || m === 'funny_roast' || m === 'dino_mascot' || m === 'comedy' || m === 'joke') return 'skit';
  if (m === 'guide' || m === 'solo_explainer' || m === 'zero_exp_roadmap' || m === 'mentor') return 'guide';
  if (m === 'voiceover' || m === 'voice' || m === 'breaking_drop' || m === 'salary_reality' || m === 'narration') return 'voiceover';
  return undefined;
}

function brollQueries(idea: VideoIdea, script: ReelScript): string[] {
  const base = [
    'indian student laptop',
    'young professional office india',
    'job interview',
    'college students campus',
    'person typing code',
    'stressed student studying',
    'team meeting office',
    'person smartphone scrolling',
  ];
  const topical = `${idea.pillar} ${script.title}`.toLowerCase();
  const picks: string[] = [];
  if (/interview|hr/.test(topical)) picks.push('job interview');
  if (/salary|ctc|money|tax|sip/.test(topical)) picks.push('counting money', 'calculator finance');
  if (/ai|tool|chatgpt/.test(topical)) picks.push('person using laptop ai');
  if (/code|dsa|developer/.test(topical)) picks.push('programmer coding');
  if (/resume|linkedin/.test(topical)) picks.push('resume paper desk');
  return Array.from(new Set([...picks, ...base.sort(() => Math.random() - 0.5)])).slice(0, 4);
}

interface StageHandle {
  stage: IStage;
  done: (itemsOut?: number) => Promise<void>;
  fail: (msg: string) => Promise<void>;
}

/**
 * Executes the Animated Reel Pipeline:
 *   trends -> fresh idea (novelty-scored) -> cast -> script -> human-like multi-voice TTS
 *   -> animated character render with lip-sync & captions -> publish -> content memory
 */
export async function runVideoReelPipeline(
  runId: string,
  slot: string,
  forcedModeOrArchetype?: DeliveryMode | ReelArchetype | string,
  _legacyFormat?: string
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

  const baseUrl = process.env.BASE_PUBLIC_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const forcedMode = resolveMode(forcedModeOrArchetype) || resolveMode(process.env.VIDEO_MODE);
  const seed = (Date.now() ^ parseInt(runId.slice(-6), 16)) >>> 0;
  const workDir = path.join(process.cwd(), '.temp_video', `run_${runId}`);

  const startStage = async (name: IStage['name'], itemsIn = 1): Promise<StageHandle> => {
    const stage: IStage = { name, status: 'running', startedAt: new Date(), itemsIn, itemsOut: 0 };
    return {
      stage,
      done: async (itemsOut = 1) => {
        stage.status = 'completed';
        stage.itemsOut = itemsOut;
        stage.completedAt = new Date();
        run.stages.push(stage);
        await run.save();
      },
      fail: async (msg: string) => {
        stage.status = 'failed';
        stage.errorMessage = msg;
        stage.completedAt = new Date();
        run.stages.push(stage);
        await run.save();
      },
    };
  };

  console.log(`[VideoPipeline] Starting animated reel pipeline (run ${runId}, mode=${forcedMode || 'auto'})`);

  try {
    // 1. COLLECT live signals
    const collect = await startStage('collect');
    const trends = await discoverTrends({ niche: 'fresher_careers', preferBreakout: true, limit: 12 });
    console.log(`[VideoPipeline] ${trends.length} signals: ${trends.map((t) => t.source).join(', ')}`);
    await collect.done(trends.length);

    // 2. IDEATE: fresh, novelty-scored idea
    const rank = await startStage('rank', trends.length);
    const { idea, candidates } = await forgeFreshIdea({ trends, forcedMode, runId });
    console.log(
      `[VideoPipeline] Idea picked (${idea.mode}/${idea.setting}, novelty ${idea.novelty}): "${idea.title}" — ${idea.angle}`
    );
    console.log(`[VideoPipeline] Other candidates: ${candidates.slice(1, 4).map((c) => `"${c.title}" [${c.mode}]`).join(' | ')}`);
    await rank.done(1);

    // 3. WRITE: cast + script
    const write = await startStage('write');
    const cast: CastMember[] = idea.castCount > 0 ? buildCast(idea.castCount, seed, idea.castRoles) : [];
    const script = await directScript(idea, cast, runId);
    console.log(`[VideoPipeline] Script "${script.title}" (${script.lines.length} lines):`);
    for (const l of script.lines) {
      const who = cast.find((c) => c.id === l.speaker)?.name || 'Narrator';
      console.log(`   ${who} [${l.emotion}${l.punchline ? ', PUNCHLINE' : ''}]: ${l.text}`);
    }
    await write.done(script.lines.length);

    // 4. RENDER: voice -> animation -> mp4
    const render = await startStage('render', script.lines.length);
    fs.mkdirSync(workDir, { recursive: true });
    const audio = await synthesizeDialogue(scriptToVoiceLines(script, cast, seed), path.join(workDir, 'audio'));
    console.log(`[VideoPipeline] Voice ready: ${audio.totalDurationSec}s via ${audio.providers.join('+')}`);
    if (audio.providers.includes('silent')) {
      console.warn('[VideoPipeline] Some lines have NO voice (TTS unavailable). Install edge-tts: pip install -r requirements.txt');
    }

    const broll = script.mode === 'voiceover' ? await fetchBroll(brollQueries(idea, script), path.join(workDir, 'broll')) : [];
    const videoFileName = `reel_${runId}.mp4`;
    const videoFilePath = path.join(process.cwd(), 'public', 'videos', videoFileName);
    let result: RenderResult;
    try {
      result = await renderReel({
        script,
        cast,
        audio,
        setting: idea.setting,
        outputPath: videoFilePath,
        workDir,
        seed,
        broll,
        bgmPath: pickBackgroundMusic(),
      });
    } catch (err: any) {
      await render.fail(err.message);
      throw err;
    }
    const finalVideoUrl = `${baseUrl.replace(/\/+$/, '')}/videos/${videoFileName}`;
    await Asset.create({
      runId,
      type: 'video',
      url: finalVideoUrl,
      slideIndex: 0,
      width: result.width,
      height: result.height,
      label: `reel_${script.mode}_${idea.setting}`,
      generatedAt: new Date(),
    }).catch(() => null);
    console.log(`[VideoPipeline] Rendered ${videoFilePath} (${result.durationSec}s, ${result.frames} frames)`);
    await render.done(1);

    await recordVideoToMemory({
      topic: idea.title,
      niche: idea.pillar,
      targetAudience: process.env.CONTENT_AUDIENCE || 'freshers',
      formatType: script.mode,
      archetype: script.mode,
      uniqueAngle: idea.angle,
      hookText: script.lines[0]?.text || script.title,
      hookType: script.mode,
      narrativeStructure: script.lines.map((l) => l.emotion).join('>'),
      visualStyle: idea.setting,
      tags: script.hashtags,
      viralityScore: idea.novelty,
      runId,
    });

    // 5. PUBLISH
    const caption = `${script.caption}\n\n${script.hashtags.join(' ')}`.trim();
    if (process.env.VIDEO_PUBLISH === 'false') {
      console.log('[VideoPipeline] VIDEO_PUBLISH=false — skipping publish.');
    } else {
      const publish = await startStage('publish');
      try {
        const publishResult = await publishToZernio({
          content: caption,
          mediaUrls: [finalVideoUrl],
          mediaType: 'video',
          publishNow: true,
        });
        const accounts = await listConnectedAccounts();
        for (const acc of accounts) {
          await Post.create({
            runId,
            platform: acc.platform || acc.type,
            externalPostId: publishResult?._id || publishResult?.id,
            postUrl: publishResult?.url,
            caption,
            status: 'published',
          }).catch(() => null);
        }
        run.postsPublished = accounts.length || 1;
        await publish.done(accounts.length || 1);
      } catch (pubErr: any) {
        console.error('[VideoPipeline] Publish failed:', pubErr.message);
        await publish.fail(pubErr.message);
      }
    }

    run.status = 'completed';
    run.completedAt = new Date();
    await run.save();
    console.log(`[VideoPipeline] Run ${runId} COMPLETED`);
  } catch (err: any) {
    console.error(`[VideoPipeline] Run ${runId} FAILED:`, err);
    run.status = 'failed';
    run.errorMessage = err.message || 'Video pipeline execution failed';
    run.completedAt = new Date();
    await run.save();
  } finally {
    try {
      if (process.env.KEEP_TEMP !== 'true') fs.rmSync(workDir, { recursive: true, force: true });
    } catch {}
  }
}
