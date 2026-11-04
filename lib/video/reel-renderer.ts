/**
 * Node-side wrappers around the Python voice + render workers.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { CastMember, narratorVoices } from './cast';
import { ReelScript } from './script-director';

const execFileAsync = promisify(execFile);

export function resolveFfmpegPath(): string {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const inst = require('@ffmpeg-installer/ffmpeg');
    if (inst?.path && fs.existsSync(inst.path)) return inst.path;
  } catch {}
  const candidates = [
    path.join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
    path.join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'linux-x64', 'ffmpeg'),
    path.join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'darwin-arm64', 'ffmpeg'),
  ];
  return candidates.find((c) => fs.existsSync(c)) || 'ffmpeg';
}

const PYTHON = () => process.env.PYTHON_BIN || 'python';

async function runPythonJson<T>(script: string, spec: any, specPath: string, timeoutMs: number): Promise<T> {
  await fs.promises.writeFile(specPath, JSON.stringify(spec), 'utf-8');
  const { stdout, stderr } = await execFileAsync(PYTHON(), [script, specPath], {
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  if (stderr?.trim()) console.log(stderr.trim().split('\n').map((l) => `  ${l}`).join('\n'));
  const last = stdout.trim().split('\n').pop() || '{}';
  return JSON.parse(last) as T;
}

// --------------------------------------------------------------------------- //
// Voice
// --------------------------------------------------------------------------- //

export interface TimedWord { word: string; start: number; end: number }
export interface TimedLine {
  id: string;
  speaker: string;
  text: string;
  start: number;
  end: number;
  words: TimedWord[];
  provider: string;
}
export interface DialogueAudio {
  masterAudioPath: string;
  totalDurationSec: number;
  providers: string[];
  lines: TimedLine[];
}

export interface VoiceLineInput {
  id: string;
  speaker: string;
  text: string;
  spokenText?: string;
  voice: string;
  rate?: string;
  pitch?: string;
  pauseAfter?: number;
  female?: boolean;
  elevenVoiceId?: string;
}

export async function synthesizeDialogue(lines: VoiceLineInput[], workDir: string, opts: { offline?: boolean } = {}): Promise<DialogueAudio> {
  fs.mkdirSync(workDir, { recursive: true });
  return runPythonJson<DialogueAudio>(
    path.join(process.cwd(), 'lib', 'video', 'tts_worker.py'),
    {
      lines,
      outputDir: workDir,
      masterOutput: path.join(workDir, 'master.wav'),
      ffmpeg: resolveFfmpegPath(),
      offline: opts.offline ?? process.env.OFFLINE === 'true',
    },
    path.join(workDir, 'tts_spec.json'),
    180_000
  );
}

/** Map a script + cast to voice lines (narrator voice chosen randomly for voiceover). */
export function scriptToVoiceLines(script: ReelScript, cast: CastMember[], seed: number): VoiceLineInput[] {
  const byId = new Map(cast.map((c) => [c.id, c]));
  const voices = narratorVoices();
  const narrator = voices[seed % voices.length];
  const narratorEleven =
    (narrator.gender === 'm' ? process.env.ELEVENLABS_MALE_VOICES : process.env.ELEVENLABS_FEMALE_VOICES)?.split(',')[0]?.trim() ||
    undefined;
  return script.lines.map((l, i) => {
    const c = byId.get(l.speaker);
    // speak a little faster when excited, slower when sad
    const tempoRate = l.emotion === 'shocked' || l.emotion === 'angry' ? 6 : l.emotion === 'sad' ? -6 : 0;
    const baseRate = parseInt((c?.rate || narrator.rate).replace('%', ''), 10) || 0;
    return {
      id: `l${i}`,
      speaker: l.speaker,
      text: l.text,
      // long '...' pauses make TTS drag; speak them as a short comma pause
      spokenText: ((c?.voice || narrator.voice).startsWith('hi-IN') && l.spoken ? l.spoken : l.text)
        .replace(/\.{2,}|…/g, ',')
        .replace(/['"“”‘’]/g, '')
        .replace(/,\s*,/g, ','),
      voice: c?.voice || narrator.voice,
      rate: `${baseRate + tempoRate >= 0 ? '+' : ''}${baseRate + tempoRate}%`,
      pitch: c?.pitch || narrator.pitch,
      pauseAfter: l.pauseAfter ?? (script.mode === 'skit' ? 0.18 : 0.28),
      female: (c?.gender || narrator.gender) === 'f',
      elevenVoiceId: c?.elevenVoiceId || (l.speaker === 'narrator' ? narratorEleven : undefined),
    };
  });
}

// --------------------------------------------------------------------------- //
// B-roll (optional real-human stock footage via Pexels, free API key)
// --------------------------------------------------------------------------- //

export async function fetchBroll(queries: string[], workDir: string, max = 4): Promise<string[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  fs.mkdirSync(workDir, { recursive: true });
  const out: string[] = [];
  for (const q of queries.slice(0, max)) {
    try {
      const res = await axios.get('https://api.pexels.com/videos/search', {
        params: { query: q, orientation: 'portrait', per_page: 8, size: 'medium' },
        headers: { Authorization: key },
        timeout: 10000,
      });
      const vids = (res.data?.videos || []).filter((v: any) => v.duration >= 4);
      if (!vids.length) continue;
      const v = vids[Math.floor(Math.random() * Math.min(vids.length, 5))];
      const file =
        (v.video_files || [])
          .filter((f: any) => f.height >= 1280 && f.height <= 2160 && f.file_type === 'video/mp4')
          .sort((a: any, b: any) => a.height - b.height)[0] || v.video_files?.[0];
      if (!file?.link) continue;
      const dest = path.join(workDir, `broll_${out.length}.mp4`);
      const dl = await axios.get(file.link, { responseType: 'arraybuffer', timeout: 60000 });
      await fs.promises.writeFile(dest, Buffer.from(dl.data));
      out.push(dest);
    } catch (err: any) {
      console.warn(`[Broll] "${q}" failed: ${err.message}`);
    }
  }
  return out;
}

/** Optional background music: drop royalty-free mp3s into assets/music/. */
export function pickBackgroundMusic(): string | undefined {
  const dir = process.env.BGM_DIR || path.join(process.cwd(), 'assets', 'music');
  try {
    const files = fs.readdirSync(dir).filter((f) => /\.(mp3|wav|m4a)$/i.test(f));
    if (!files.length) return undefined;
    return path.join(dir, files[Math.floor(Math.random() * files.length)]);
  } catch {
    return undefined;
  }
}

// --------------------------------------------------------------------------- //
// Render
// --------------------------------------------------------------------------- //

export interface RenderResult {
  output: string;
  durationSec: number;
  frames: number;
  fps: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

export interface RenderReelInput {
  script: ReelScript;
  cast: CastMember[];
  audio: DialogueAudio;
  setting: string;
  outputPath: string;
  workDir: string;
  seed: number;
  broll?: string[];
  bgmPath?: string;
  fps?: number;
}

export async function renderReel(input: RenderReelInput): Promise<RenderResult> {
  const { script, cast, audio, setting, outputPath, workDir, seed } = input;
  const lines = audio.lines.map((tl, i) => {
    const sl = script.lines[i] || script.lines[script.lines.length - 1];
    return { ...sl, ...tl, speaker: sl.speaker };
  });
  const spec = {
    output: outputPath,
    ffmpeg: resolveFfmpegPath(),
    fps: input.fps || Number(process.env.REEL_FPS || 30),
    seed,
    mode: script.mode,
    setting,
    title: script.title,
    cta: script.cta,
    brand: process.env.BRAND_HANDLE || 'dinomate.app',
    cast,
    audioPath: audio.masterAudioPath,
    totalDuration: audio.totalDurationSec,
    lines,
    broll: input.broll || [],
    bgmPath: input.bgmPath,
    preset: process.env.REEL_X264_PRESET || 'veryfast',
  };
  return runPythonJson<RenderResult>(
    path.join(process.cwd(), 'lib', 'video', 'render', 'render_reel.py'),
    spec,
    path.join(workDir, 'render_spec.json'),
    20 * 60_000
  );
}
