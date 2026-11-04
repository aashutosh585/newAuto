import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execFileAsync = promisify(execFile);

function resolveFfmpegPath(): string {
  const candidates = [
    path.join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
    path.join(process.cwd(), 'node_modules', '.pnpm', '@ffmpeg-installer+win32-x64@4.1.0', 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'ffmpeg';
}

export interface VideoAssemblerOptions {
  sceneImages: string[]; // local file paths or HTTP URLs
  outputPath: string; // Destination file path (e.g. public/videos/reel_123.mp4)
  durations?: number[]; // Duration in seconds per scene (matches TTS audio)
  audioPath?: string; // Synchronized narration MP3
  fps?: number;
  transitionFrames?: number;
}

export interface VideoAssemblerResult {
  outputPath: string;
  publicUrl?: string;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  durationSec: number;
  fileSizeBytes: number;
  fileSizeMb: number;
  hasAudio: boolean;
}

/**
 * Downloads a remote image URL to a local buffer or path
 */
async function ensureLocalImage(source: string, tempDir: string, index: number): Promise<string> {
  if (fs.existsSync(source)) {
    return source;
  }

  const localPath = path.join(tempDir, `scene_${index}_${Date.now()}.png`);
  const response = await axios.get(source, {
    responseType: 'arraybuffer',
    timeout: 20000,
  });

  await fs.promises.writeFile(localPath, Buffer.from(response.data));
  return localPath;
}

/**
 * Assembles 1080x1920 vertical video reels from scene images, adding smooth transitions and neural voice audio.
 */
export async function assembleReelVideo(options: VideoAssemblerOptions): Promise<VideoAssemblerResult> {
  const { sceneImages, outputPath, durations, audioPath, fps = 24, transitionFrames = 10 } = options;

  if (!sceneImages || sceneImages.length === 0) {
    throw new Error('assembleReelVideo requires at least one scene image');
  }

  const resolvedOutputPath = path.resolve(outputPath);
  const outputDir = path.dirname(resolvedOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const tempDir = path.join(process.cwd(), '.temp_video', `render_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const resolvedImages: string[] = [];

  try {
    for (let i = 0; i < sceneImages.length; i++) {
      const localFile = await ensureLocalImage(sceneImages[i], tempDir, i);
      resolvedImages.push(localFile);
    }

    const rawVideoPath = audioPath ? path.join(tempDir, 'raw_visual.mp4') : resolvedOutputPath;

    // Enforce strict 15-20 second total reel duration target
    let effectiveDurations = durations && durations.length > 0 ? [...durations] : [3.5, 3.5, 3.5, 3.5, 3.0];
    const totalD = effectiveDurations.reduce((a, b) => a + b, 0);
    if (totalD > 20.0 || totalD < 15.0) {
      const scale = 17.5 / totalD;
      effectiveDurations = effectiveDurations.map((d) => Number((d * scale).toFixed(2)));
    }

    // Write render spec JSON for python visual stitcher
    const specPath = path.join(tempDir, 'render_spec.json');
    const spec = {
      images: resolvedImages,
      output: rawVideoPath,
      fps,
      durations: effectiveDurations,
      transitionFrames,
    };

    await fs.promises.writeFile(specPath, JSON.stringify(spec, null, 2), 'utf-8');

    // Run python visual video stitcher
    const pythonScript = path.join(process.cwd(), 'lib', 'stitch_video.py');
    const { stdout, stderr } = await execFileAsync('python', [pythonScript, specPath]);

    if (stderr && stderr.trim().length > 0) {
      console.warn('[VideoAssembler] Python warning:', stderr);
    }

    const lines = stdout.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    const visualResult = JSON.parse(lastLine);

    let hasAudio = false;

    // If voiceover audio was provided, mux visual stream and audio stream with FFmpeg
    if (audioPath && fs.existsSync(audioPath)) {
      const ffmpegBinary = resolveFfmpegPath();
      console.log(`[VideoAssembler] Muxing audio track (${audioPath}) with visual reel using FFmpeg (${ffmpegBinary})...`);
      try {
        await execFileAsync(ffmpegBinary, [
          '-y',
          '-i', rawVideoPath,
          '-i', audioPath,
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-shortest',
          resolvedOutputPath,
        ]);
        hasAudio = true;
      } catch (ffErr: any) {
        console.warn('[VideoAssembler] FFmpeg mux error, using visual video:', ffErr.message);
        if (rawVideoPath !== resolvedOutputPath && fs.existsSync(rawVideoPath)) {
          fs.copyFileSync(rawVideoPath, resolvedOutputPath);
        }
      }
    }

    const finalStats = fs.statSync(resolvedOutputPath);
    const durationSec = visualResult.durationSec;
    const fileSizeMb = Number((finalStats.size / (1024 * 1024)).toFixed(2));

    const result: VideoAssemblerResult = {
      outputPath: resolvedOutputPath,
      width: visualResult.width,
      height: visualResult.height,
      fps: visualResult.fps,
      totalFrames: visualResult.totalFrames,
      durationSec,
      fileSizeBytes: finalStats.size,
      fileSizeMb,
      hasAudio,
    };

    // Compute public URL if placed under public directory
    const publicDir = path.resolve(process.cwd(), 'public');
    if (resolvedOutputPath.startsWith(publicDir)) {
      const relPath = path.relative(publicDir, resolvedOutputPath).replace(/\\/g, '/');
      result.publicUrl = `/${relPath}`;
    }

    return result;
  } finally {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  }
}
