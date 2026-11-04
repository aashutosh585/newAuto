import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface SceneTtsInput {
  name: string;
  text: string;
  voice?: string;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface SceneTtsOutput {
  name: string;
  audioPath: string;
  durationSec: number;
  text: string;
  words?: WordTimestamp[];
}

export interface FullTtsResult {
  masterAudioPath: string;
  timestampsPath?: string;
  totalDurationSec: number;
  scenes: SceneTtsOutput[];
  wordTimestamps?: WordTimestamp[];
}

export interface VoiceoverOptions {
  voice?: string;
  offline?: boolean;
}

/**
 * Generates natural neural voice narration for video scenes using Microsoft Edge TTS,
 * with automatic synthetic audio timing fallback when offline or in test environments.
 */
export async function generateReelVoiceover(
  scenes: SceneTtsInput[],
  outputDir: string,
  voiceOrOptions?: string | VoiceoverOptions
): Promise<FullTtsResult> {
  const resolvedDir = path.resolve(outputDir);
  fs.mkdirSync(resolvedDir, { recursive: true });

  const voice =
    typeof voiceOrOptions === 'string'
      ? voiceOrOptions
      : voiceOrOptions?.voice || 'hi-IN-MadhurNeural';

  const offline =
    typeof voiceOrOptions === 'object' && voiceOrOptions?.offline !== undefined
      ? voiceOrOptions.offline
      : process.env.OFFLINE === 'true' || process.env.CI === 'true';

  const specPath = path.join(resolvedDir, `tts_spec_${Date.now()}.json`);
  const masterAudioPath = path.join(resolvedDir, 'master_narration.mp3');

  const config = {
    scenes,
    outputDir: resolvedDir,
    masterOutput: masterAudioPath,
    voice,
    offline,
  };

  await fs.promises.writeFile(specPath, JSON.stringify(config, null, 2), 'utf-8');

  try {
    const pythonScript = path.join(process.cwd(), 'lib', 'video', 'tts_worker.py');
    const { stdout, stderr } = await execFileAsync('python', [pythonScript, specPath]);

    if (stderr && stderr.trim().length > 0) {
      console.warn('[VideoTTS] Worker notice:', stderr);
    }

    const lines = stdout.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    const result: FullTtsResult = JSON.parse(lastLine);

    return result;
  } finally {
    try {
      if (fs.existsSync(specPath)) {
        fs.unlinkSync(specPath);
      }
    } catch {}
  }
}
