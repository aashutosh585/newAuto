import { StructuredContentBrief, StoryboardScene } from './script-brief-engine';

export interface QualityIssue {
  type: 'duration' | 'aspect_ratio' | 'sync' | 'template_reuse' | 'factual_claim' | 'copyright' | 'consistency';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestedFix?: string;
  autoFixed?: boolean;
}

export interface QualityValidationReport {
  passed: boolean;
  score: number; // 0 - 100
  issues: QualityIssue[];
  fixedBrief?: StructuredContentBrief;
}

const UNVERIFIED_CLAIM_PATTERNS = [
  /100%\s*(guarantee|placement|job|pass)/i,
  /guaranteed\s*(job|salary|lpa|selection)/i,
  /get\s*rich\s*(quick|overnight)/i,
  /zero\s*effort/i,
  /earn\s*crores\s*in\s*a\s*month/i,
];

const COPYRIGHT_FLAGS = [
  /microsoft\s*confidential/i,
  /google\s*internal\s*only/i,
  /leaked\s*exam\s*paper/i,
];

/**
 * Validates a video brief and production parameters against all quality rules.
 */
export function runVideoQualityCheck(params: {
  brief: StructuredContentBrief;
  targetDurationSec?: number;
  aspectRatio?: '9:16' | '1:1' | '16:9';
  actualDurationSec?: number;
}): QualityValidationReport {
  const { brief, targetDurationSec = 18, aspectRatio = '9:16', actualDurationSec } = params;
  const issues: QualityIssue[] = [];
  let score = 100;
  let fixedStoryboard: StoryboardScene[] = [...brief.storyboard];
  let autoFixed = false;

  // 1. Duration Validation (Strict 15-20 Second Reel Limit)
  const estimatedTotalDuration = brief.storyboard.reduce((sum, s) => sum + (s.estimatedDurationSec || 3.5), 0);
  const testDuration = actualDurationSec || estimatedTotalDuration;

  if (testDuration < 15) {
    issues.push({
      type: 'duration',
      severity: 'high',
      description: `Video duration (${testDuration}s) is below required 15-20 second range. Minimum duration is 15 seconds.`,
      suggestedFix: 'Expand scene narration to meet 15-20s target.',
    });
    score -= 20;
  } else if (testDuration > 20) {
    issues.push({
      type: 'duration',
      severity: 'medium',
      description: `Video duration (${testDuration}s) exceeds required 15-20 second reel limit.`,
      suggestedFix: 'Auto-scaling scene durations to fit strictly within 15-20 seconds.',
      autoFixed: true,
    });
    score -= 10;

    // Scale scenes down to 17.5s target
    const scale = 17.5 / testDuration;
    fixedStoryboard = fixedStoryboard.map((s) => ({
      ...s,
      estimatedDurationSec: Number(((s.estimatedDurationSec || 3.5) * scale).toFixed(1)),
    }));
    autoFixed = true;
  }

  // 2. Aspect Ratio Validation
  const allowedRatios = ['9:16', '1:1', '16:9'];
  if (!allowedRatios.includes(aspectRatio)) {
    issues.push({
      type: 'aspect_ratio',
      severity: 'high',
      description: `Unsupported aspect ratio: "${aspectRatio}". Must be 9:16 (vertical), 1:1 (square), or 16:9 (widescreen).`,
      suggestedFix: 'Set aspect ratio to 9:16 for Reels/Shorts or 1:1 for Carousels.',
    });
    score -= 30;
  }

  // 3. Captions & Narration Speaking Rate Sync
  brief.storyboard.forEach((scene, idx) => {
    const wordCount = scene.narrationText.split(/\s+/).filter(Boolean).length;
    const duration = scene.estimatedDurationSec || 5;
    const wordsPerSec = wordCount / duration;

    // Fast short-form speaking rate is 2.5 - 3.6 words/sec
    if (wordsPerSec > 3.8) {
      issues.push({
        type: 'sync',
        severity: 'medium',
        description: `Scene ${idx + 1} (${scene.name}): Narration speaking rate is slightly fast (${wordsPerSec.toFixed(1)} words/sec for ${duration}s).`,
        suggestedFix: 'Auto-adjusting scene duration to match neural audio pace.',
        autoFixed: true,
      });
      score -= 5;

      // Auto-fix duration to match natural speech rate
      const adjustedDuration = Math.max(2.8, Math.min(4.2, Number((wordCount / 3.0).toFixed(1))));
      fixedStoryboard[idx] = {
        ...fixedStoryboard[idx],
        estimatedDurationSec: adjustedDuration,
      };
      autoFixed = true;
    }
  });

  // 4. Repeated Scenes & Template Reuse Check
  for (let i = 0; i < brief.storyboard.length; i++) {
    for (let j = i + 1; j < brief.storyboard.length; j++) {
      const s1 = brief.storyboard[i];
      const s2 = brief.storyboard[j];
      if (s1.narrationText && s2.narrationText && s1.narrationText === s2.narrationText) {
        issues.push({
          type: 'template_reuse',
          severity: 'high',
          description: `Identical narration detected between Scene ${i + 1} and Scene ${j + 1}.`,
          suggestedFix: 'Write distinct content for each scene.',
        });
        score -= 20;
      }
    }
  }

  // 5. Unsupported Factual Claims & Sensationalism
  brief.storyboard.forEach((scene, idx) => {
    UNVERIFIED_CLAIM_PATTERNS.forEach((pattern) => {
      if (pattern.test(scene.narrationText)) {
        issues.push({
          type: 'factual_claim',
          severity: 'high',
          description: `Scene ${idx + 1} contains unverified absolute claim matching "${pattern.source}". Violates platform guidelines.`,
          suggestedFix: 'Rephrase to highlight verified openings rather than guaranteeing outcomes.',
          autoFixed: true,
        });
        score -= 10;

        // Auto-fix: soften the claim
        fixedStoryboard[idx] = {
          ...fixedStoryboard[idx],
          narrationText: fixedStoryboard[idx].narrationText
            .replace(/100%\s*guaranteed\s*job/gi, 'verified entry-level opportunity')
            .replace(/guaranteed\s*selection/gi, 'direct interview shortlist')
            .replace(/zero\s*effort/gi, 'focused preparation'),
        };
        autoFixed = true;
      }
    });

    COPYRIGHT_FLAGS.forEach((pattern) => {
      if (pattern.test(scene.narrationText)) {
        issues.push({
          type: 'copyright',
          severity: 'high',
          description: `Scene ${idx + 1} contains sensitive trademark or leaked material phrasing matching "${pattern.source}".`,
          suggestedFix: 'Remove internal confidential references.',
        });
        score -= 25;
      }
    });
  });

  const passed = score >= 70;
  const fixedBrief: StructuredContentBrief | undefined = autoFixed
    ? { ...brief, storyboard: fixedStoryboard }
    : undefined;

  return {
    passed,
    score: Math.max(0, score),
    issues,
    fixedBrief,
  };
}
