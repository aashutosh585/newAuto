/**
 * AI Quality Critic Engine (Inspired by realisticHelp/OpenReels Critic Agent)
 * 
 * Evaluates video scripts across 7 weighted dimensions:
 * 1. Hook Strength (20%) - Lands in <= 3 seconds, powerful psychological trigger
 * 2. Narrative Arc (20%) - Coherent progression matching chosen format
 * 3. Pacing & Word Budget (15%) - Strictly 40-55 words (15-20s duration)
 * 4. Visual Variety (15%) - Distinct visual compositions across scenes
 * 5. Visual-Narration Sync (10%) - Visual copy reinforces voiceover
 * 6. Style & Tone Adherence (10%) - Matches selected archetype and Indian cultural humor
 * 7. CTA Urgency (10%) - Explicit comment trigger keyword
 * 
 * Overall score = round(Hook*0.20 + Arc*0.20 + Pacing*0.15 + Variety*0.15 + Sync*0.10 + Style*0.10 + CTA*0.10)
 * Pass threshold: 7.0 / 10.0
 */

import { StructuredContentBrief, StoryboardScene } from './script-brief-engine';

export interface RubricDimensionScore {
  name: string;
  weight: number;
  score: number; // 1 - 10
  feedback: string;
}

export interface CriticEvaluationReport {
  overallScore: number; // 1.0 - 10.0
  passed: boolean; // >= 7.0
  dimensions: RubricDimensionScore[];
  strengths: string[];
  weaknesses: string[];
  weakestSceneIndex: number | null;
  revisionInstructions: string | null;
  totalWordCount: number;
  estimatedSpeechDurationSec: number;
}

export function evaluateBriefWithCritic(brief: StructuredContentBrief): CriticEvaluationReport {
  const dimensions: RubricDimensionScore[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  const scenes = brief.storyboard || [];
  const totalWords = scenes.reduce((acc, s) => {
    return acc + (s.narrationText ? s.narrationText.trim().split(/\s+/).length : 0);
  }, 0);

  // Natural speech speed for Indian tech reels: ~2.8 words/second
  const estimatedDuration = Number((totalWords / 2.75).toFixed(1));

  // 1. Hook Strength (Weight: 20%)
  const hookScene = scenes[0];
  const hookWords = hookScene?.narrationText ? hookScene.narrationText.trim().split(/\s+/).length : 0;
  let hookScore = 8;
  let hookFeedback = 'Hook is engaging and punchy.';

  if (hookWords > 13) {
    hookScore = 5;
    hookFeedback = `Hook is too long (${hookWords} words). Must land in under 3 seconds (<= 12 words).`;
    weaknesses.push('Hook is wordy, risking viewer swipe-away in first 2 seconds.');
  } else if (
    hookScene?.narrationText.includes('Dost') ||
    hookScene?.narrationText.includes('Dino') ||
    hookScene?.narrationText.includes('Stop') ||
    hookScene?.narrationText.includes('Why') ||
    hookScene?.narrationText.includes('Trick')
  ) {
    hookScore = 9;
    hookFeedback = 'High-impact hook with strong emotional trigger or comedy.';
    strengths.push('Hook immediately grabs attention with relatable emotion or surprise.');
  }

  dimensions.push({
    name: 'Hook Strength',
    weight: 0.20,
    score: hookScore,
    feedback: hookFeedback,
  });

  // 2. Narrative Arc (Weight: 20%)
  let arcScore = 8.5;
  let arcFeedback = 'Clear progression from problem/hook to evidence to resolution.';
  if (scenes.length < 4 || scenes.length > 6) {
    arcScore = 6;
    arcFeedback = `Scene count (${scenes.length}) deviates from optimal 5-scene reel structure.`;
    weaknesses.push('Story progression should adhere to 5 structured scenes.');
  } else {
    strengths.push('5-scene narrative arc ensures disciplined delivery.');
  }

  dimensions.push({
    name: 'Narrative Arc',
    weight: 0.20,
    score: arcScore,
    feedback: arcFeedback,
  });

  // 3. Pacing & Word Budget (Weight: 15%)
  let pacingScore = 9;
  let pacingFeedback = `Word count is ${totalWords} words (~${estimatedDuration}s natural speech).`;

  if (totalWords > 58) {
    pacingScore = 5;
    pacingFeedback = `Total word count (${totalWords} words) exceeds strict 15-20s reel limit. Target is 40-55 words.`;
    weaknesses.push('Script is too long for a 15-20s reel without unnatural voice speedup.');
  } else if (totalWords < 38) {
    pacingScore = 6;
    pacingFeedback = `Total word count (${totalWords} words) is below 15s duration minimum. Target is 40-55 words.`;
    weaknesses.push('Script is too brief, might end before 15 seconds.');
  } else {
    strengths.push(`Perfect word budget (${totalWords} words) aligns naturally with 15-20s duration.`);
  }

  dimensions.push({
    name: 'Pacing & Word Budget',
    weight: 0.15,
    score: pacingScore,
    feedback: pacingFeedback,
  });

  // 4. Visual Variety (Weight: 15%)
  let varietyScore = 8.5;
  const layouts = new Set(scenes.map((s) => s.name));
  if (layouts.size < 4) {
    varietyScore = 6.5;
    weaknesses.push('Scene types lack sufficient visual contrast across scenes.');
  } else {
    strengths.push('Distinct scene layouts prevent visual monotony.');
  }

  dimensions.push({
    name: 'Visual Variety',
    weight: 0.15,
    score: varietyScore,
    feedback: `Uses ${layouts.size} unique scene compositions.`,
  });

  // 5. Visual-Narration Sync (Weight: 10%)
  let syncScore = 8.5;
  const unsynced = scenes.some(
    (s) => !s.onScreenHeadline || s.onScreenHeadline.trim().length < 3
  );
  if (unsynced) {
    syncScore = 6;
    weaknesses.push('Some scenes have missing or empty on-screen headlines.');
  } else {
    strengths.push('Visual titles closely support audio narration.');
  }

  dimensions.push({
    name: 'Visual-Narration Sync',
    weight: 0.10,
    score: syncScore,
    feedback: 'Visual headlines and spoken voiceover are well synchronized.',
  });

  // 6. Style & Tone Adherence (Weight: 10%)
  let styleScore = 9;
  const hasHinglish = scenes.some(
    (s) =>
      s.narrationText.includes('bhai') ||
      s.narrationText.includes('karo') ||
      s.narrationText.includes('hai') ||
      s.narrationText.includes('pe') ||
      s.narrationText.includes('Dino')
  );
  if (!hasHinglish && brief.narrationStyle.tone === 'roast_comedy') {
    styleScore = 6.5;
    weaknesses.push('Indian comedic roast tone needs authentic Hinglish slang for college audience.');
  } else {
    strengths.push('Authentic conversational Hinglish dialect matches target Indian demographic.');
  }

  dimensions.push({
    name: 'Style & Tone Adherence',
    weight: 0.10,
    score: styleScore,
    feedback: 'Tone aligns with Indian tech fresher culture.',
  });

  // 7. CTA Urgency (Weight: 10%)
  const ctaScene = scenes[scenes.length - 1];
  let ctaScore = 8.5;
  let ctaFeedback = 'CTA clearly directs viewers to take action.';
  const hasKeyword =
    ctaScene?.narrationText.includes('APPLY') ||
    ctaScene?.narrationText.includes('DINO') ||
    ctaScene?.onScreenHeadline.includes('APPLY');

  if (!hasKeyword) {
    ctaScore = 6;
    ctaFeedback = "CTA lacks specific keyword trigger (e.g. 'Comment APPLY').";
    weaknesses.push('CTA should explicitly prompt comment keyword for automated DM delivery.');
  } else {
    strengths.push("Explicit high-conversion comment keyword trigger ('APPLY' / 'DINO').");
  }

  dimensions.push({
    name: 'CTA Urgency',
    weight: 0.10,
    score: ctaScore,
    feedback: ctaFeedback,
  });

  // Calculate weighted overall score
  const overall = dimensions.reduce((acc, dim) => acc + dim.score * dim.weight, 0);
  const overallScore = Number(overall.toFixed(1));
  const passed = overallScore >= 7.0;

  // Identify weakest scene if revision needed
  let weakestSceneIndex: number | null = null;
  let revisionInstructions: string | null = null;

  if (!passed || hookScore < 7 || pacingScore < 7) {
    // Find scene with most words or biggest issue
    let maxWords = 0;
    scenes.forEach((s, i) => {
      const wc = s.narrationText.split(/\s+/).length;
      if (wc > maxWords) {
        maxWords = wc;
        weakestSceneIndex = i;
      }
    });

    if (hookScore < 7) {
      weakestSceneIndex = 0;
      revisionInstructions =
        'Trim Scene 1 (Hook) to under 10 words. Punch directly into the shocking fact or funny situation within 2.5 seconds.';
    } else if (pacingScore < 7 && weakestSceneIndex !== null) {
      revisionInstructions = `Trim Scene ${weakestSceneIndex + 1} (${scenes[weakestSceneIndex].name}). Reduce from ${maxWords} words to max 10 words to ensure total script remains within 40-55 words.`;
    }
  }

  return {
    overallScore,
    passed,
    dimensions,
    strengths,
    weaknesses,
    weakestSceneIndex,
    revisionInstructions,
    totalWordCount: totalWords,
    estimatedSpeechDurationSec: estimatedDuration,
  };
}
