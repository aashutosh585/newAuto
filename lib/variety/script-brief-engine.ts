import { executeLLM } from '../litellm';
import { TrendEvidence } from '../trend/trend-discovery';
import { VideoFormatId, FORMAT_REGISTRY, FormatSpecification } from './format-engine';

export interface StoryboardScene {
  sceneNumber: number;
  name: 'hook' | 'eligibility' | 'skills' | 'salary' | 'cta';
  sceneAction: string;
  visualDescription: string;
  cameraDirection: string;
  onScreenHeadline: string;
  onScreenSubtext: string;
  roastDialogue?: string;
  narrationText: string;
  estimatedDurationSec: number;
}

export interface StructuredContentBrief {
  trendEvidence: {
    topic: string;
    source: string;
    sourceUrl: string;
    velocityScore: number;
    isBreakout: boolean;
  };
  targetAudience: string;
  selectedFormat: VideoFormatId;
  formatName: string;
  uniqueAngle: string;
  hookBlueprint: {
    spokenHook: string;
    visualHook: string;
    onScreenText: string;
    hookType: string;
  };
  narrativeStructure: string;
  storyboard: StoryboardScene[];
  visualDirection: {
    styleArchetype: string;
    colorPalette: string;
    aestheticLighting: string;
  };
  narrationStyle: {
    tone: string;
    speakerPersona: string;
    humorLevel: 'none' | 'light_witty' | 'hilarious_sarcastic' | 'roast';
    recommendedVoice: string;
  };
  callToAction: {
    spokenCta: string;
    onScreenAction: string;
    keywordTrigger: string;
  };
  metadata: {
    title: string;
    caption: string;
    hashtags: string[];
  };
}

export type HumorStyle =
  | 'friend_roast'
  | 'corporate_sarcasm'
  | 'placement_drama'
  | 'fresher_struggle'
  | 'dino_mascot'
  | 'dino_mascot_comedy'
  | 'solo_mentor_explainer';

export interface BriefGenerationOptions {
  trend: TrendEvidence;
  format: FormatSpecification;
  preferHumor?: boolean;
  humorStyle?: HumorStyle;
  runId?: string;
  skipLLMNetwork?: boolean;
}

/**
 * Accurately estimate scene duration strictly calibrated for 15-20 second reels.
 * Average scene duration is ~3.0-3.8s across 5 scenes (total: 15-20s).
 */
export function estimateSceneDuration(text: string, targetSec = 3.5): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  const calc = words > 0 ? Number((words / 3.2).toFixed(1)) : targetSec;
  return Math.max(2.8, Math.min(3.8, calc));
}

/**
 * Builds a 10-point Structured Content Brief using AI and format specifications.
 */
export async function generateStructuredBrief(options: BriefGenerationOptions): Promise<StructuredContentBrief> {
  const { trend, format, preferHumor = false, humorStyle = 'friend_roast', runId, skipLLMNetwork = false } = options;

  if (skipLLMNetwork) {
    return buildTailoredFormatBrief(trend, format, preferHumor, humorStyle);
  }

  const humorPromptInstructions = preferHumor
    ? `
🔥 COMPLETE HUMOR & COMEDY SCRIPT INSTRUCTIONS:
You MUST write this entire script in an intensely funny, punchy, relatable, and comedic style!
Humor Sub-Style: ${humorStyle.toUpperCase()}

1. CHARACTER CONFLICT & DIALOGUE IN SCENE 1:
   - FRIEND: Sarcastic, poking fun at protagonist's unemployment or engineering degree. Example: "Bhai 4 saal engineering karke ab chai ki tapri kholega kya?"
   - ME: Snappy, witty rebuttal pointing to a verified DinoMate fresher job drop. Example: "Ruk bhai! DinoMate pe verified SDE opening aayi hai bina 3 saal experience ke, package dekh ke tu khud apply karega!"
2. RELATABLE HUMOR BEATS:
   - Mocking ridiculous job descriptions that demand 5 years of experience from freshers.
   - Mocking campus placement cell false promises.
   - Writing conversational, natural, high-energy spoken lines (~2.2-2.8 words/sec).
3. 5-SCENE COMIC BEATS:
   - Scene 1 (Hook): Brutal friend roast dialogue + immediate verified revelation.
   - Scene 2 (Eligibility): Mocking 99% CGPA / IIT myths; BCA, MCA, B.Tech grads all qualify.
   - Scene 3 (Skills): "No need to build rocket engines, just clean Python/JS and GitHub projects."
   - Scene 4 (Salary): "Rs. 6-14 LPA — enough to pay back college tapri debt and buy biryani."
   - Scene 5 (CTA): "Comment APPLY before your friend steals the job and roasts you from his AC cubicle."`
    : `
PROFESSIONAL VALUE DIRECTIVE:
Deliver high-authority, data-backed career intelligence with clear structure and crisp pacing.`;

  const systemPrompt = `You are an elite short-form video creative director and virality strategist.
You design high-retention video content for Instagram Reels and YouTube Shorts (STRICTLY 15-20 SECONDS TOTAL DURATION).

AUDIENCE & HINDI VOICE DIRECTIVE (CRITICAL):
- Primary Language: Natural conversational Hindi. Narration sentences MUST be spoken in Hindi (e.g. "Dost ne bola engineering ke baad chai tapri kholega kya? Ruk bhai, ye role dekh!").
- Technical Terms in English: Technical keywords, tools, degrees, and hiring terms MUST be used in English for natural tech speech (e.g. Software Engineer, Python, JavaScript, DSA, SQL, Git, GitHub, Resume, CTC, LPA, Package, Fresher, Startups, Apply, Comment).
- Single Default Voice: Strictly 'hi-IN-MadhurNeural' (the premier natural Hindi neural voice).
- Authentic Indian Humor: Include relatable cultural tropes (e.g., friend roasting degree, chai tapri, Sharma ji ka beta comparison, placement cell jokes, biryani treats).
- Audio Voice: hi-IN-MadhurNeural with natural Indian Hindi cadence.

DURATION & PACING DIRECTIVE (CRITICAL):
- Total reel duration MUST be strictly between 15 and 20 seconds.
- Total script word count across all 5 scenes combined MUST be 40 to 55 words total (~8-11 words per scene).
- Do NOT write long paragraphs. Keep every single line punchy, rapid-fire, and concise (~3-4 seconds per scene).

FORMAT SELECTED: ${format.name} (${format.id})
FORMAT TAGLINE: ${format.tagline}
NARRATIVE ARC: ${format.narrativeArc.join(' -> ')}
IDEAL PACING: ${format.idealPacing}
RECOMMENDED TONE: ${format.narrationTone}
${humorPromptInstructions}

CRITICAL RULES:
1. Generate an ORIGINAL script. Use trend evidence as inspiration and research, NOT material to copy.
2. Structure into EXACTLY 5 cohesive storyboard scenes: hook, eligibility, skills, salary, cta.
3. Every narration scene MUST be punchy, engaging, and spoken in natural conversational speech (3-4 seconds each).
4. Output STRICT JSON conforming to the requested schema.`;

  const userPrompt = `Generate a complete 10-point Structured Content Brief for this trending topic:
TREND TOPIC: "${trend.topic}"
TREND SUMMARY: ${trend.summary}
NICHE: ${trend.niche}
EVIDENCE SOURCE: ${trend.source} (${trend.sourceUrl})
BREAKOUT SIGNAL: ${trend.isBreakout ? 'Yes (Sudden Acceleration)' : 'Steady Velocity'}
SUGGESTED ANGLES: ${trend.suggestedAngles.join(' | ')}

Return strictly valid JSON with targetAudience, uniqueAngle, hookBlueprint, narrativeStructure, storyboard (5 scenes), visualDirection, narrationStyle, callToAction, and metadata.`;

  try {
    const aiResponse = await executeLLM<any>({
      alias: 'writer',
      jsonMode: true,
      runId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const data = aiResponse.data;
    if (data && data.storyboard && Array.isArray(data.storyboard) && data.storyboard.length === 5) {
      return {
        trendEvidence: {
          topic: trend.topic,
          source: trend.source,
          sourceUrl: trend.sourceUrl,
          velocityScore: trend.velocityScore,
          isBreakout: trend.isBreakout,
        },
        targetAudience: data.targetAudience || 'College graduates and fresher tech job seekers',
        selectedFormat: format.id,
        formatName: format.name,
        uniqueAngle: data.uniqueAngle || trend.suggestedAngles[0] || 'Fresh take on entry-level tech opportunities',
        hookBlueprint: data.hookBlueprint || {
          spokenHook: data.storyboard[0]?.narrationText || 'Stop scrolling if you need a tech job.',
          visualHook: 'Bold high-contrast split card',
          onScreenText: data.storyboard[0]?.onScreenHeadline || 'Fresher Job Alert',
          hookType: preferHumor ? 'pov' : 'question',
        },
        narrativeStructure: data.narrativeStructure || format.narrativeArc.join(' -> '),
        storyboard: (() => {
          const scenes = data.storyboard.map((s: any, idx: number) => {
            const narrationText = (s.narrationText || '').replace(/₹/g, 'Rs. ');
            return {
              sceneNumber: idx + 1,
              name: ['hook', 'eligibility', 'skills', 'salary', 'cta'][idx] as any,
              sceneAction: s.sceneAction || 'Presenting key information',
              visualDescription: s.visualDescription || 'Dynamic backdrop with clear text cards',
              cameraDirection: s.cameraDirection || 'Steady push-in',
              onScreenHeadline: s.onScreenHeadline || `Scene ${idx + 1}`,
              onScreenSubtext: s.onScreenSubtext || '',
              roastDialogue: s.roastDialogue,
              narrationText,
              estimatedDurationSec: s.estimatedDurationSec || estimateSceneDuration(narrationText),
            };
          });
          const rawTotal = scenes.reduce((sum: number, sc: any) => sum + sc.estimatedDurationSec, 0);
          if (rawTotal > 20.0 || rawTotal < 15.0) {
            const scale = 17.5 / rawTotal;
            scenes.forEach((sc: any) => {
              sc.estimatedDurationSec = Number((sc.estimatedDurationSec * scale).toFixed(1));
            });
          }
          return scenes;
        })(),
        visualDirection: data.visualDirection || {
          styleArchetype: preferHumor ? 'funny_neon' : 'clean_modern',
          colorPalette: 'Electric blue and slate dark',
          aestheticLighting: 'Crisp studio lighting',
        },
        narrationStyle: data.narrationStyle || {
          tone: format.narrationTone,
          speakerPersona: preferHumor ? 'Hilarious roast friend' : 'Witty tech mentor',
          humorLevel: preferHumor ? 'hilarious_sarcastic' : 'light_witty',
          recommendedVoice: format.recommendedVoices[0] || 'hi-IN-MadhurNeural',
        },
        callToAction: data.callToAction || {
          spokenCta: 'Comment APPLY right now for the direct link!',
          onScreenAction: "Comment 'APPLY' below",
          keywordTrigger: 'APPLY',
        },
        metadata: data.metadata || {
          title: trend.topic.slice(0, 75),
          caption: `${trend.topic}\n\nComment APPLY for the verified link! #jobs #freshers`,
          hashtags: ['#freshers', '#engineering', '#techjobs'],
        },
      };
    }
  } catch (err: any) {
    console.warn('[ScriptBriefEngine] LLM brief generation notice, generating tailored format brief:', err.message);
  }

  // Fallback: Format-specific structured brief generator
  return buildTailoredFormatBrief(trend, format, preferHumor, humorStyle);
}

/**
 * Builds a deterministic, high-quality structured brief tailored to each format and humor style.
 */
function buildTailoredFormatBrief(
  trend: TrendEvidence,
  format: FormatSpecification,
  preferHumor: boolean,
  humorStyle: HumorStyle = 'friend_roast'
): StructuredContentBrief {
  const isRoast = preferHumor || format.id === 'pov' || format.id === 'cinematic_narrative';

  let roastDialogue: string | undefined;
  let hookNarration = '';
  let eligibilityNarration = '';
  let skillsNarration = '';
  let salaryNarration = '';
  let ctaNarration = '';
  let hookHeadline = '';
  let hookSubtext = '';

  if (isRoast && (humorStyle === 'dino_mascot_comedy' || humorStyle === 'dino_mascot')) {
    roastDialogue = 'Dino: "Recruiter freshers se 5 saal exp maang raha hai? Jurassic era se code karun kya?"';
    hookNarration = 'Dino ne dekha 5 saal exp fresher se maang rahe hain? Drama band karo! DinoMate drop dekho.';
    eligibilityNarration = 'DinoMate pe aayi verified zero-exp openings 2024 se 2026 batch sabhi degrees ke liye.';
    skillsNarration = 'Bas clean Python ya JavaScript, basic DSA aur do solid projects chahiye.';
    salaryNarration = 'Starting package 7 se 14 LPA! Chai tapri se seedhe startup cabin tak!';
    ctaNarration = 'Comment karo DINO direct verified HR link ke liye!';
    hookHeadline = 'Dino Roasts Ridiculous Job Posts';
    hookSubtext = 'DinoMate Verified 0-Exp Openings';
  } else if (humorStyle === 'solo_mentor_explainer') {
    roastDialogue = undefined;
    hookNarration = '2024 se 2026 batch me ho aur callbacks nahi aa rahe? Dhyan se suniye.';
    eligibilityNarration = 'Top product startups ne direct entry-level software openings open ki hain.';
    skillsNarration = 'Assessment me bas clean problem solving, basic SQL aur working demo chahiye.';
    salaryNarration = 'Verified starting package 6 se 14 LPA direct full-time PPO.';
    ctaNarration = 'Comment karo APPLY direct verified hiring desk referral ke liye.';
    hookHeadline = 'Solo Mentor Career Breakdown';
    hookSubtext = 'Off-Campus Fresher Roadmap 2025';
  } else if (isRoast && humorStyle === 'corporate_sarcasm') {
    roastDialogue = 'Friend: "Fresher job ke liye 5 saal exp maang rahe hain!" Me: "DinoMate pe real 0-exp roles live hain!"';
    hookNarration = 'HR bole fresher ko 5 saal experience chahiye? Is corporate scam me mat phaso!';
    eligibilityNarration = 'Zero purana experience. 2024 se 2026 batch all degrees direct apply karein.';
    skillsNarration = 'Bas clean Python, JavaScript aur do solid GitHub projects chahiye.';
    salaryNarration = 'Starting package 6 se 12 LPA direct full-time PPO ke saath.';
    ctaNarration = 'Comment karo APPLY direct verified HR link ke liye!';
    hookHeadline = '5 Years Exp for Fresher Job?';
    hookSubtext = 'Real 0-Exp Openings Dropped';
  } else if (isRoast && humorStyle === 'placement_drama') {
    roastDialogue = 'Friend: "Placement cell ne bola 40 LPA, sales nikla!" Me: "Direct DinoMate tech jobs apply kar!"';
    hookNarration = 'Placement cell ne bola 40 LPA aur haath me sales thama diya?';
    eligibilityNarration = 'Tier-1 college ka bias khatam. 2024 se 2026 batch sabhi qualify karte hain.';
    skillsNarration = 'Bas clean problem solving, web fundamentals aur basic SQL queries chahiye.';
    salaryNarration = 'Verified starting CTC 6.5 se 14 LPA top tech startups me.';
    ctaNarration = 'Comment karo APPLY aur campus placement politics ko bye-bye bolo!';
    hookHeadline = 'College Placement Scam?';
    hookSubtext = 'Verified Tech SDE Roles Live';
  } else if (isRoast && humorStyle === 'fresher_struggle') {
    roastDialogue = 'Friend: "500 jobs apply ki, ek bhi reply nahi!" Me: "DinoMate pe direct HR apply link hai!"';
    hookNarration = 'LinkedIn pe 500 jagah apply kiya aur sirf rejection bots mile?';
    eligibilityNarration = '2024 se 2026 passout ke liye open hai. Koi 90 percent filter nahi.';
    skillsNarration = 'Clean readable code, basic Git workflow aur practical projects chahiye.';
    salaryNarration = 'Starting package 6 se 13 LPA laptop allowance ke saath.';
    ctaNarration = 'Comment karo APPLY direct hiring desk tak pahunchne ke liye!';
    hookHeadline = '500 Applications, 0 Replies?';
    hookSubtext = 'Direct HR Access Openings';
  } else if (isRoast) {
    // Default friend_roast
    roastDialogue = 'Friend: "Engineering ho gayi, ab chai tapri kholega?" Me: "Ruk bhai! DinoMate pe verified SDE role aayi hai!"';
    hookNarration = 'Dost ne bola engineering ke baad chai tapri kholega kya? Ruk bhai, ye role dekh!';
    eligibilityNarration = 'Koi IIT degree nahi chahiye. 2024 se 2026 batches direct apply karein.';
    skillsNarration = 'Bas basic DSA, clean code aur do GitHub projects chahiye.';
    salaryNarration = 'Package 6 se 14 LPA! Tapri ka udhaar ab chukao!';
    ctaNarration = 'Comment karo APPLY isse pehle ki dost ye job le le!';
    hookHeadline = 'When Your Friend Roasts Your Degree';
    hookSubtext = 'Until This Verified Opening Dropped';
  } else if (format.id === 'myth_vs_fact') {
    hookNarration = 'Myth: You need a CS degree from Tier-1 college to get a high-paying job. Here is reality.';
    eligibilityNarration = 'Fact: Product firms actively hire 2024 to 2026 grads from all degrees.';
    skillsNarration = 'Fact: Companies test practical code logic, not college reputation.';
    salaryNarration = 'Verified starting CTC is Rs. 6 to 14 LPA with remote options.';
    ctaNarration = 'Comment APPLY right now to claim your verified application link!';
    hookHeadline = 'Myth vs Fact: Fresher Hiring';
    hookSubtext = 'What Tech Recruiters Actually Want';
  } else if (format.id === 'news_explainer') {
    hookNarration = 'Breaking tech hiring alert: Top product firms opened direct entry-level applications today.';
    eligibilityNarration = 'Zero to one year experience. All 2024 to 2026 degree holders qualify.';
    skillsNarration = 'Assessment covers basic Python, JavaScript, and problem solving.';
    salaryNarration = 'Verified fresher packages benchmarked at Rs. 6 to 14 LPA.';
    ctaNarration = 'Comment APPLY right now before batch quotas fill up!';
    hookHeadline = '🚨 Urgent Tech Hiring Alert';
    hookSubtext = 'Batch Quotas Now Open';
  } else if (format.id === 'problem_vs_solution') {
    hookNarration = 'The Problem: 2000 applicants per fresher job on LinkedIn. Here is your unfair advantage.';
    eligibilityNarration = 'The Solution: Targeted verification filters. Only 2024 to 2026 batches evaluated.';
    skillsNarration = 'Clean GitHub commits and modular code beat 90 percent of applicants.';
    salaryNarration = 'Compensation benchmarked at Rs. 6 to 14 LPA for product trainees.';
    ctaNarration = 'Comment APPLY right now for the direct referral portal!';
    hookHeadline = 'The Fresher Hiring Bottleneck';
    hookSubtext = 'And How To Bypass It Today';
  } else {
    hookNarration = `Stop scrolling. A massive fresher hiring shift is happening in tech right now.`;
    eligibilityNarration = 'No 99 percent CGPA or tier-1 college needed. 2024 to 2026 grads apply directly.';
    skillsNarration = 'Basic DSA, clean Python or JavaScript, and two projects on GitHub.';
    salaryNarration = 'The package ranges from Rs. 6 to 14 LPA across top fast-growing startups.';
    ctaNarration = 'Comment APPLY right now to get the direct application link in your DMs.';
    hookHeadline = format.storyboardBeats.scene1.slice(0, 40);
    hookSubtext = 'Verified Entry-Level Opportunity';
  }

  const storyboard: StoryboardScene[] = [
    {
      sceneNumber: 1,
      name: 'hook',
      sceneAction: isRoast ? 'Friend laughing sarcastically at unemployment' : 'Investigative question with bold text',
      visualDescription: 'Split screen with bold warning banner and contrast cards',
      cameraDirection: 'Dynamic punch zoom',
      onScreenHeadline: hookHeadline || (isRoast ? 'When Your Friend Roasts Your Degree' : format.storyboardBeats.scene1.slice(0, 40)),
      onScreenSubtext: hookSubtext || (isRoast ? 'Until this verified opening dropped' : 'Verified Entry-Level Opportunity'),
      roastDialogue,
      narrationText: hookNarration,
      estimatedDurationSec: estimateSceneDuration(hookNarration, 3.6),
    },
    {
      sceneNumber: 2,
      name: 'eligibility',
      sceneAction: 'Clear checkmarks appearing next to batches and degrees',
      visualDescription: 'Eligibility checklist with glowing approved badges',
      cameraDirection: 'Slow steady push-in',
      onScreenHeadline: 'Who Can Actually Apply',
      onScreenSubtext: '2024, 2025 & 2026 Batches | B.Tech, BCA, MCA, BSc',
      narrationText: eligibilityNarration,
      estimatedDurationSec: estimateSceneDuration(eligibilityNarration, 3.5),
    },
    {
      sceneNumber: 3,
      name: 'skills',
      sceneAction: 'Visual tags showing clean coding and GitHub projects',
      visualDescription: 'Code editor snippet and skill badges',
      cameraDirection: 'Subtle pan right',
      onScreenHeadline: 'Real Skills Required',
      onScreenSubtext: 'Python / JavaScript, Basic DSA, SQL & Git',
      narrationText: skillsNarration,
      estimatedDurationSec: estimateSceneDuration(skillsNarration, 3.5),
    },
    {
      sceneNumber: 4,
      name: 'salary',
      sceneAction: 'Package cards highlighting verified CTC',
      visualDescription: 'Green badge showing verified starting compensation',
      cameraDirection: 'Centered focus',
      onScreenHeadline: 'Verified CTC & Companies',
      onScreenSubtext: 'Rs. 6 LPA - Rs. 14 LPA | Tech Startups & MNCs',
      narrationText: salaryNarration,
      estimatedDurationSec: estimateSceneDuration(salaryNarration, 3.4),
    },
    {
      sceneNumber: 5,
      name: 'cta',
      sceneAction: 'Direct comment prompt with button tap animation',
      visualDescription: 'Prominent comment callout with arrow cue',
      cameraDirection: 'Quick snap zoom',
      onScreenHeadline: 'Direct Application Link',
      onScreenSubtext: "Comment 'APPLY' for direct HR referral link",
      narrationText: ctaNarration,
      estimatedDurationSec: estimateSceneDuration(ctaNarration, 3.0),
    },
  ];

  // Guarantee total brief duration strictly within 15-20 seconds
  const totalBriefDuration = storyboard.reduce((sum, s) => sum + s.estimatedDurationSec, 0);
  if (totalBriefDuration > 20.0 || totalBriefDuration < 15.0) {
    const scale = 17.5 / totalBriefDuration;
    storyboard.forEach((s) => {
      s.estimatedDurationSec = Number((s.estimatedDurationSec * scale).toFixed(1));
    });
  }

  return {
    trendEvidence: {
      topic: trend.topic,
      source: trend.source,
      sourceUrl: trend.sourceUrl,
      velocityScore: trend.velocityScore,
      isBreakout: trend.isBreakout,
    },
    targetAudience: 'College freshers, BCA/MCA graduates, tier-3 job seekers',
    selectedFormat: format.id,
    formatName: format.name,
    uniqueAngle: trend.suggestedAngles[0] || 'Turning rejection into an immediate verified interview opportunity',
    hookBlueprint: {
      spokenHook: storyboard[0].narrationText,
      visualHook: storyboard[0].visualDescription,
      onScreenText: storyboard[0].onScreenHeadline,
      hookType: isRoast ? 'pov' : 'question',
    },
    narrativeStructure: format.narrativeArc.join(' -> '),
    storyboard,
    visualDirection: {
      styleArchetype: isRoast ? 'funny_neon' : 'clean_modern',
      colorPalette: 'Electric blue and cyber dark cards with emerald green badges',
      aestheticLighting: 'Crisp studio gradient with bold typography',
    },
    narrationStyle: {
      tone: format.narrationTone,
      speakerPersona: isRoast ? 'Hilarious roast friend' : 'Insighter career mentor',
      humorLevel: isRoast ? 'hilarious_sarcastic' : 'light_witty',
      recommendedVoice: format.recommendedVoices[0] || 'hi-IN-MadhurNeural',
    },
    callToAction: {
      spokenCta: storyboard[4].narrationText,
      onScreenAction: "Comment 'APPLY' below",
      keywordTrigger: 'APPLY',
    },
    metadata: {
      title: trend.topic.slice(0, 80),
      caption: `${isRoast ? 'Friend roasted me for having no job... until this dropped! 😂' : trend.topic}\n\nVerified opening hiring 2024-2026 batch. Comment 'APPLY' for direct link!\n\n#freshers #softwarejobs #engineeringhumor #dinomate #careeradvice`,
      hashtags: ['#freshers', '#softwarejobs', '#careeradvice', '#dinomate'],
    },
  };
}
