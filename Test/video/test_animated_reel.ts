/**
 * End-to-end local test of the animated reel engine (no DB writes, no publishing).
 *
 *   npm run test:reel              -> engine picks the mode
 *   npm run test:reel -- skit      -> force comedy skit
 *   npm run test:reel -- guide     -> force presenter guide
 *   npm run test:reel -- voiceover -> force voice-only
 *
 * Output: public/videos/test_reel_<mode>.mp4
 */
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { discoverTrends } from '../../lib/trend/trend-discovery';
import { forgeFreshIdea } from '../../lib/trend/idea-forge';
import { buildCast } from '../../lib/video/cast';
import { directScript } from '../../lib/video/script-director';
import { synthesizeDialogue, scriptToVoiceLines, renderReel, fetchBroll, pickBackgroundMusic } from '../../lib/video/reel-renderer';
import { resolveMode } from '../../lib/video/video-pipeline';

async function main() {
  const forced = resolveMode(process.argv[2]);
  const seed = Date.now() >>> 0;
  const t0 = Date.now();

  console.log('1) Discovering trends...');
  const trends = await discoverTrends({ limit: 12, preferBreakout: true });
  trends.forEach((t, i) => console.log(`   [${i}] ${t.source.padEnd(14)} ${t.topic.slice(0, 90)}`));

  console.log('\n2) Forging a fresh idea...');
  const { idea, candidates } = await forgeFreshIdea({ trends, forcedMode: forced });
  candidates.forEach((c) => console.log(`   ${c === idea ? '>>' : '  '} [${c.mode}/${c.setting}] novelty=${c.novelty} "${c.title}"`));

  console.log('\n3) Casting + writing script...');
  const cast = idea.castCount ? buildCast(idea.castCount, seed, idea.castRoles) : [];
  cast.forEach((c) => console.log(`   ${c.id} ${c.name} (${c.role}) voice=${c.voice} ${c.pitch}`));
  const script = await directScript(idea, cast);
  console.log(`   TITLE: ${script.title}`);
  script.lines.forEach((l) =>
    console.log(`   ${(cast.find((c) => c.id === l.speaker)?.name || 'Narrator').padEnd(8)} [${l.emotion}] ${l.text}`)
  );

  const work = path.join(process.cwd(), '.temp_video', `test_${seed}`);
  console.log('\n4) Synthesising voices...');
  const audio = await synthesizeDialogue(scriptToVoiceLines(script, cast, seed), path.join(work, 'audio'));
  console.log(`   ${audio.totalDurationSec}s via ${audio.providers.join('+')}`);

  console.log('\n5) Rendering animation...');
  const broll = script.mode === 'voiceover' ? await fetchBroll(['indian student laptop', 'office team meeting', 'job interview'], path.join(work, 'broll')) : [];
  const out = path.join(process.cwd(), 'public', 'videos', `test_reel_${script.mode}.mp4`);
  const res = await renderReel({ script, cast, audio, setting: idea.setting, outputPath: out, workDir: work, seed, broll, bgmPath: pickBackgroundMusic() });
  if (process.env.KEEP_TEMP !== 'true') fs.rmSync(work, { recursive: true, force: true });

  console.log(`\nDONE in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${res.output} (${res.durationSec}s, audio=${res.hasAudio})`);
  console.log(`Caption:\n${script.caption}\n${script.hashtags.join(' ')}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
