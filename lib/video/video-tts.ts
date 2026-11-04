import path from 'path';

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
 * Legacy single-voice scene narration (kept for older callers/tests).
 * Now backed by the multi-speaker dialogue worker, so it gets real neural audio
 * and real word timings instead of silent placeholder frames.
 */
export async function generateReelVoiceover(
  scenes: SceneTtsInput[],
  outputDir: string,
  voiceOrOptions?: string | VoiceoverOptions
): Promise<FullTtsResult> {
  const { synthesizeDialogue } = await import('./reel-renderer');
  const voice =
    typeof voiceOrOptions === 'string' ? voiceOrOptions : voiceOrOptions?.voice || 'en-IN-PrabhatNeural';
  const offline = typeof voiceOrOptions === 'object' ? voiceOrOptions?.offline : undefined;

  const res = await synthesizeDialogue(
    scenes.map((s, i) => ({ id: `s${i}`, speaker: s.name, text: s.text, voice: s.voice || voice, pauseAfter: 0.2 })),
    path.resolve(outputDir),
    { offline }
  );
  const sceneOut: SceneTtsOutput[] = res.lines.map((l, i) => {
    const next = res.lines[i + 1];
    return {
      name: l.speaker,
      audioPath: res.masterAudioPath,
      durationSec: Number(((next ? next.start : res.totalDurationSec) - l.start).toFixed(2)),
      text: l.text,
      words: l.words,
    };
  });
  return {
    masterAudioPath: res.masterAudioPath,
    totalDurationSec: res.totalDurationSec,
    scenes: sceneOut,
    wordTimestamps: res.lines.flatMap((l) => l.words),
  };
}
