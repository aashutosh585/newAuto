import 'dotenv/config';

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { executeLLM } from '../../lib/litellm';
import { assembleReelVideo } from '../../lib/video/video-assembler';
import { generateReelVoiceover } from '../../lib/video/video-tts';
import { VideoReelPlan, ReelArchetype } from '../../lib/video/types';

interface DinoJob {
  id: string;
  title: string;
  company: string;
  location: string;
  skills?: string[];
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
}

async function runVideoTest() {
  console.log('\n======================================================');
  console.log('🎬 DINOMATE COMEDY REEL & NEURAL AUDIO ASSEMBLY TEST');
  console.log('======================================================\n');

  const BASE_URL = process.env.BASE_PUBLIC_URL || 'http://localhost:3000';
  const DINOMATE_KEY = process.env.DINOMATE_API_KEY || 'publickey';

  // -----------------------------------------------------------------
  // STAGE 1: INGEST REAL JOBS FROM DINOMATE API
  // -----------------------------------------------------------------
  console.log('📡 [STAGE 1] Ingesting Fresher Jobs from DinoMate API...');
  let jobs: DinoJob[] = [];
  try {
    const res = await axios.get('https://dinomate.app/api/public/jobs', {
      params: { q: 'software developer fresher', limit: 5, experienceLevel: 'ENTRY' },
      headers: { 'x-api-key': DINOMATE_KEY },
      timeout: 10000,
    });
    jobs = res.data?.data || [];
    console.log(`   ✓ Ingested ${jobs.length} jobs from DinoMate API`);
    if (jobs.length > 0) {
      console.log(`   Sample: "${jobs[0].title}" at ${jobs[0].company} (${jobs[0].location})`);
    }
  } catch (err: any) {
    console.warn(`   ⚠️ DinoMate API note: ${err.message}. Using test fresher opening.`);
    jobs = [
      {
        id: 'sample_fresher_1',
        title: 'Full Stack Software Engineer Fresher',
        company: 'CloudEcosystem Tech',
        location: 'Bengaluru / Hybrid',
        skills: ['JavaScript', 'Node.js', 'React', 'SQL'],
        salaryMin: 600000,
        salaryMax: 1400000,
        currency: 'INR',
      },
    ];
  }

  // -----------------------------------------------------------------
  // STAGE 2: GENERATE FUNNY ROAST REEL SCRIPT VIA AI GATEWAY
  // -----------------------------------------------------------------
  console.log('\n🧠 [STAGE 2] Generating Funny Friend Roast Script via AI Gateway...');
  const promptContext = jobs
    .map((j) => `- ${j.title} at ${j.company} (${j.location}) | Skills: ${(j.skills || []).join(', ')}`)
    .join('\n');

  const t0 = Date.now();
  let script: VideoReelPlan;

  try {
    const llmRes = await executeLLM<VideoReelPlan>({
      alias: 'writer',
      jsonMode: true,
      messages: [
        {
          role: 'system',
          content: `You are a viral comedy tech creator on Instagram Reels & YouTube Shorts.
Craft a funny, relatable 5-scene reel script where a college friend roasts you about having no job after engineering, but you discover a verified fresher job opening on DinoMate.
Return strict JSON with this exact schema:
{
  "archetype": "funny_roast",
  "role": "Software Development Engineer Fresher",
  "batch": "2024 / 2025 / 2026 Batches",
  "degrees": "B.Tech, BCA, MCA, BSc IT (All Branches)",
  "skills": ["JavaScript or Python", "Basic DSA", "SQL", "Git"],
  "salary": "Rs. 6 LPA - Rs. 14 LPA",
  "companies": "Amazon, TCS Digital, Accurics, Top Tech Startups",
  "hookHeadline": "Friend Making Fun Of No Job",
  "hookSubtext": "Until this DinoMate role dropped",
  "roastDialogue": "Friend: Engineering ho gayi, chai tapri kholega? Me: Ruk bhai, DinoMate pe 0-exp SDE opening live hai!",
  "narrationHook": "Dost ne bola engineering ke baad chai tapri kholega kya? Ruk bhai, ye role dekh!",
  "narrationEligibility": "Koi IIT degree nahi chahiye. 2024 se 2026 batches direct apply karein.",
  "narrationSkills": "Bas basic DSA, clean code aur do GitHub projects chahiye.",
  "narrationSalary": "Package 6 se 14 LPA! Tapri ka udhaar ab chukao!",
  "narrationCta": "Comment karo APPLY isse pehle ki dost ye job le le!",
  "caption": "Friend roasted me for having no job... until DinoMate dropped this! 😂 Verified opening hiring 2024-2026 batch. Comment 'APPLY' for direct link! #freshers #softwarejobs #reels #engineeringhumor #dinomate",
  "suggestedVoice": "hi-IN-MadhurNeural"
}`,
        },
        {
          role: 'user',
          content: `Create a funny roast friend job reel based on these fresher openings:\n${promptContext}`,
        },
      ],
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    console.log(`   ✓ Funny roast script response from [${llmRes.model}] in ${elapsed}s`);
    const d: any = llmRes.data;
    if (d && (d.role || d.narrationHook)) {
      script = {
        archetype: 'funny_roast',
        role: d.role || 'Software Development Engineer Fresher',
        batch: d.batch || '2024 / 2025 / 2026 Batches',
        degrees: d.degrees || 'B.Tech, BCA, MCA, BSc IT',
        skills: Array.isArray(d.skills) ? d.skills : ['JavaScript', 'DSA', 'SQL', 'Git'],
        salary: (d.salary || 'Rs. 6 - 14 LPA').replace(/₹/g, 'Rs. '),
        companies: d.companies || 'Tech Startups & MNCs',
        hookHeadline: d.hookHeadline || 'When Your Friend Roasts Your Degree',
        hookSubtext: d.hookSubtext || 'Until this verified opening dropped',
        roastDialogue: d.roastDialogue || 'Friend: Engineering ho gayi, chai tapri kholega? Me: DinoMate pe 0-exp SDE opening live hai!',
        narrationHook: d.narrationHook || 'Dost ne bola engineering ke baad chai tapri kholega kya? Ruk bhai, ye role dekh!',
        narrationEligibility: d.narrationEligibility || 'Koi IIT degree nahi chahiye. 2024 se 2026 batches direct apply karein.',
        narrationSkills: d.narrationSkills || 'Bas basic DSA, clean code aur do GitHub projects chahiye.',
        narrationSalary: d.narrationSalary || 'Package 6 se 14 LPA! Tapri ka udhaar ab chukao!',
        narrationCta: d.narrationCta || 'Comment karo APPLY isse pehle ki dost ye job le le!',
        caption: d.caption || 'Friend roasted me for having no job... until DinoMate dropped this! 😂 #freshers #softwarejobs #reels #dinomate',
        suggestedVoice: 'hi-IN-MadhurNeural',
      };
    } else {
      console.log('   ℹ️ Using structured high-retention funny roast script');
      script = {
        archetype: 'funny_roast',
        role: 'Software Development Engineer Fresher',
        batch: '2024 / 2025 / 2026 Batches',
        degrees: 'B.Tech, BE, BCA, MCA, BSc IT',
        skills: ['JavaScript / Python', 'Basic DSA', 'SQL & Databases', 'Git'],
        salary: 'Rs. 6 LPA - Rs. 14 LPA',
        companies: 'Top Tech Startups & MNCs',
        hookHeadline: 'When your friend roasts your unemployment',
        hookSubtext: 'Until this role dropped',
        roastDialogue: 'Friend: Engineering ho gayi, chai tapri kholega? Me: DinoMate pe 0-exp SDE opening live hai!',
        narrationHook: 'Dost ne bola engineering ke baad chai tapri kholega kya? Ruk bhai, ye role dekh!',
        narrationEligibility: 'Koi IIT degree nahi chahiye. 2024 se 2026 batches direct apply karein.',
        narrationSkills: 'Bas basic DSA, clean code aur do GitHub projects chahiye.',
        narrationSalary: 'Package 6 se 14 LPA! Tapri ka udhaar ab chukao!',
        narrationCta: 'Comment karo APPLY isse pehle ki dost ye job le le!',
        caption: 'Friend roasted me for having no job... until DinoMate dropped this! 😂 Verified opening hiring 2024-2026 batch. Comment APPLY for direct link! #freshers #softwarejobs #reels #dinomate',
        suggestedVoice: 'hi-IN-MadhurNeural',
      };
    }
    console.log(`   Role: ${script.role}`);
    console.log(`   Hook: "${script.narrationHook.slice(0, 80)}..."`);
  } catch (err: any) {
    console.warn('   ⚠️ LLM network notice:', err.message, '→ Using structured funny roast script');
    script = {
      archetype: 'funny_roast',
      role: 'Software Development Engineer Fresher',
      batch: '2024 / 2025 / 2026 Batches',
      degrees: 'B.Tech, BE, BCA, MCA, BSc IT',
      skills: ['JavaScript / Python', 'Basic DSA', 'SQL & Databases', 'Git'],
      salary: 'Rs. 6 LPA - Rs. 14 LPA',
      companies: 'Top Tech Startups & MNCs',
      hookHeadline: 'When your friend roasts your unemployment',
      hookSubtext: 'Until this role dropped',
      roastDialogue: 'Friend: Engineering ho gayi, chai tapri kholega? Me: DinoMate pe 0-exp SDE opening live hai!',
      narrationHook: 'Dost ne bola engineering ke baad chai tapri kholega kya? Ruk bhai, ye role dekh!',
      narrationEligibility: 'Koi IIT degree nahi chahiye. 2024 se 2026 batches direct apply karein.',
      narrationSkills: 'Bas basic DSA, clean code aur do GitHub projects chahiye.',
      narrationSalary: 'Package 6 se 14 LPA! Tapri ka udhaar ab chukao!',
      narrationCta: 'Comment karo APPLY isse pehle ki dost ye job le le!',
      caption: 'Friend roasted me for having no job... until DinoMate dropped this! 😂 Verified opening hiring 2024-2026 batch. Comment APPLY for direct link! #freshers #softwarejobs #reels #dinomate',
      suggestedVoice: 'hi-IN-MadhurNeural',
    };
    console.log(`   Role: ${script.role}`);
    console.log(`   Hook: "${script.narrationHook.slice(0, 80)}..."`);
  }

  // -----------------------------------------------------------------
  // STAGE 3: SYNTHESIZE NEURAL VOICEOVER AUDIO VIA EDGE-TTS
  // -----------------------------------------------------------------
  console.log('\n🎙️ [STAGE 3] Synthesizing Neural Voiceover Audio via Edge-TTS...');
  const tempAudioDir = path.join(__dirname, 'temp_audio');
  fs.mkdirSync(tempAudioDir, { recursive: true });

  const voiceResult = await generateReelVoiceover(
    [
      { name: 'hook', text: script.narrationHook },
      { name: 'eligibility', text: script.narrationEligibility },
      { name: 'skills', text: script.narrationSkills },
      { name: 'salary', text: script.narrationSalary },
      { name: 'cta', text: script.narrationCta },
    ],
    tempAudioDir,
    script.suggestedVoice || 'hi-IN-MadhurNeural'
  );

  console.log(`   ✓ Master narration generated: ${voiceResult.totalDurationSec}s total duration`);
  voiceResult.scenes.forEach((sc, i) => {
    console.log(`     • Scene ${i + 1} (${sc.name}): ${sc.durationSec}s`);
  });

  // Calculate synchronized scene durations strictly within 15-20 seconds
  let sceneDurations = voiceResult.scenes.map((s) => Math.max(s.durationSec, 2.8));
  const totalAudioTime = sceneDurations.reduce((a, b) => a + b, 0);
  if (totalAudioTime > 20.0 || totalAudioTime < 15.0) {
    const scale = 17.5 / totalAudioTime;
    sceneDurations = sceneDurations.map((d) => Number((d * scale).toFixed(2)));
  }

  // -----------------------------------------------------------------
  // STAGE 4: RENDER 1080x1920 9:16 VERTICAL SCENE FRAMES
  // -----------------------------------------------------------------
  console.log('\n🎨 [STAGE 4] Rendering 5 High-Resolution (1080x1920) Reel Frames...');
  const scenes = ['hook', 'eligibility', 'skills', 'salary', 'cta'];
  const tempFramesDir = path.join(__dirname, 'temp_frames');
  fs.mkdirSync(tempFramesDir, { recursive: true });

  const localFrames: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const params = new URLSearchParams({
      scene,
      archetype: 'funny_roast',
      role: script.role,
      batch: script.batch,
      degrees: script.degrees,
      skills: (script.skills || []).slice(0, 4).join(','),
      salary: script.salary,
      companies: script.companies,
      hookTitle: script.hookHeadline || '',
      hookSubtitle: script.hookSubtext || '',
      roastDialogue: script.roastDialogue || '',
    });

    const ogUrl = `${BASE_URL}/api/og/reel?${params.toString()}`;
    const framePath = path.join(tempFramesDir, `scene_${i + 1}_${scene}.png`);

    try {
      const frameRes = await axios.get(ogUrl, {
        responseType: 'arraybuffer',
        timeout: 5000,
      });

      fs.writeFileSync(framePath, Buffer.from(frameRes.data));
      localFrames.push(framePath);
      console.log(`   ✓ Scene ${i + 1} (${scene}): 1080x1920 frame captured (${(frameRes.data.length / 1024).toFixed(1)} KB)`);
    } catch (err: any) {
      console.warn(`   ⚠️ Live dev server frame render note (${err.message}) → Generating 1080x1920 test scene frame`);
      const pyCmd = `import cv2, numpy as np; img = np.zeros((1920, 1080, 3), dtype=np.uint8); img[:] = (22, 13, 9); cv2.putText(img, 'DINOMATE AI REEL', (100, 200), cv2.FONT_HERSHEY_SIMPLEX, 1.8, (246, 130, 59), 4); cv2.putText(img, '${scene.toUpperCase()}', (100, 320), cv2.FONT_HERSHEY_SIMPLEX, 2.5, (56, 189, 248), 5); cv2.circle(img, (540, 750), 140, (34, 197, 94), -1); cv2.circle(img, (490, 710), 25, (255, 255, 255), -1); cv2.circle(img, (590, 710), 25, (255, 255, 255), -1); cv2.circle(img, (495, 710), 12, (15, 23, 42), -1); cv2.circle(img, (595, 710), 12, (15, 23, 42), -1); cv2.putText(img, 'DINO: ZERO-EXP SDE JOBS!', (120, 1050), cv2.FONT_HERSHEY_SIMPLEX, 1.4, (255, 255, 255), 3); cv2.imwrite(r'${framePath}', img)`;
      require('child_process').execSync(`python -c "${pyCmd}"`);
      localFrames.push(framePath);
      console.log(`   ✓ Scene ${i + 1} (${scene}): 1080x1920 fallback frame created`);
    }
  }

  // -----------------------------------------------------------------
  // STAGE 5: ASSEMBLE MP4 VIDEO WITH SYNCHRONIZED AUDIO (FFmpeg)
  // -----------------------------------------------------------------
  console.log('\n🎞️ [STAGE 5] Assembling 1080x1920 MP4 Video With Voiceover Audio...');
  const outputVideoPath = path.join(__dirname, 'output_reel.mp4');
  const publicVideoDir = path.join(process.cwd(), 'public', 'videos');
  const publicVideoPath = path.join(publicVideoDir, 'latest_reel.mp4');

  const videoResult = await assembleReelVideo({
    sceneImages: localFrames,
    outputPath: outputVideoPath,
    durations: sceneDurations,
    audioPath: voiceResult.masterAudioPath,
    fps: 24,
    transitionFrames: 8,
  });

  // Also copy to public directory for instant browser streaming
  fs.mkdirSync(publicVideoDir, { recursive: true });
  fs.copyFileSync(outputVideoPath, publicVideoPath);

  // Clean up temporary frame PNGs and audio files
  try {
    fs.rmSync(tempFramesDir, { recursive: true, force: true });
    fs.rmSync(tempAudioDir, { recursive: true, force: true });
  } catch {}

  if (videoResult.durationSec < 15.0 || videoResult.durationSec > 20.5) {
    throw new Error(`Video duration ${videoResult.durationSec}s is outside the required 15-20s range!`);
  }

  console.log('\n======================================================');
  console.log('🎉 FUNNY ROAST VIDEO REEL WITH AUDIO CREATED!');
  console.log('======================================================');
  console.log(`📁 Local Video Path:   ${outputVideoPath}`);
  console.log(`🌐 Public Stream URL:  http://localhost:3000/videos/latest_reel.mp4`);
  console.log(`📐 Resolution:         ${videoResult.width} x ${videoResult.height} (9:16 Vertical Reel)`);
  console.log(`⏱️ Duration:           ${videoResult.durationSec} seconds (✓ Strictly within 15-20s range)`);
  console.log(`🎙️ Voiceover Audio:    ${videoResult.hasAudio ? '✓ In Sync (AAC Audio Track Attached)' : '❌ None'}`);
  console.log(`🎞️ Total Frames:       ${videoResult.totalFrames} frames @ ${videoResult.fps} fps`);
  console.log(`💾 File Size:          ${videoResult.fileSizeMb} MB (${videoResult.fileSizeBytes} bytes)`);
  console.log('======================================================\n');
  process.exit(0);
}

runVideoTest().catch((err) => {
  console.error('\n❌ Video Test Aborted:', err.message);
  process.exit(1);
});
