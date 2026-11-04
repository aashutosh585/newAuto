export type VideoFormatId =
  | 'mini_documentary'
  | 'storytelling'
  | 'pov'
  | 'myth_vs_fact'
  | 'top_listicle'
  | 'tutorial'
  | 'news_explainer'
  | 'before_vs_after'
  | 'problem_vs_solution'
  | 'experiment_challenge'
  | 'case_study'
  | 'cinematic_narrative';

export interface FormatSpecification {
  id: VideoFormatId;
  name: string;
  tagline: string;
  idealPacing: 'fast_cut' | 'measured_documentary' | 'conversational_dialogue' | 'step_by_step' | 'countdown_beats' | 'dramatic_build';
  targetDurationSec: { min: number; max: number };
  hookStrategy: string;
  narrativeArc: string[];
  visualDirection: string;
  narrationTone: string;
  suitableNiches: string[];
  recommendedVoices: string[];
  storyboardBeats: {
    scene1: string;
    scene2: string;
    scene3: string;
    scene4: string;
    scene5: string;
  };
}

export const FORMAT_REGISTRY: Record<VideoFormatId, FormatSpecification> = {
  mini_documentary: {
    id: 'mini_documentary',
    name: 'Mini Documentary',
    tagline: 'Investigative, factual deep-dive with archival curiosity',
    idealPacing: 'measured_documentary',
    targetDurationSec: { min: 15, max: 20 },
    hookStrategy: 'The Uncomfortable Question: Open with an unsettling industry reality or paradox.',
    narrativeArc: ['The Industry Paradox', 'The Hidden Mechanism', 'The Critical Evidence', 'The Systemic Impact', 'The Final Verdict'],
    visualDirection: 'Cinematic widescreen or vertical anamorphic grading, high-contrast dark palette, documentary typography, forensic graphs.',
    narrationTone: 'Investigative, authoritative, measured, thought-provoking documentarian.',
    suitableNiches: ['fresher_careers', 'salary_reality', 'tech_trends'],
    recommendedVoices: ['hi-IN-MadhurNeural'],
    storyboardBeats: {
      scene1: 'Investigative opening question with dramatic text overlay and atmospheric background.',
      scene2: 'Historical context: how companies shifted hiring models over the past 3 years.',
      scene3: 'The hidden trap: data showing true fresher salary brackets vs recruiter claims.',
      scene4: 'The game-changer: verified platforms offering direct bypass to interviews.',
      scene5: 'Closing philosophical question with actionable next step.',
    },
  },

  storytelling: {
    id: 'storytelling',
    name: 'Storytelling (Personal Journey)',
    tagline: 'Emotional, character-driven transformation arc',
    idealPacing: 'dramatic_build',
    targetDurationSec: { min: 15, max: 20 },
    hookStrategy: 'Emotional Climax Teaser: Tease the worst moment before taking the viewer back to Day 1.',
    narrativeArc: ['Inciting Crisis', 'The Rejection Spiral', 'The Breakthrough Discovery', 'The Hard Work Applied', 'The Triumphant Result'],
    visualDirection: 'Warm narrative lighting, character expression focus, emotional color transitions from desaturated to golden hour.',
    narrationTone: 'Vulnerable, authentic, inspiring, personal confessional.',
    suitableNiches: ['fresher_careers', 'humor_roasts'],
    recommendedVoices: ['hi-IN-MadhurNeural'],
    storyboardBeats: {
      scene1: 'Opening shock: sitting with 200 job rejection emails.',
      scene2: 'The lowest point: parents asking about placements.',
      scene3: 'The pivot: stopping generic applications and fixing the exact 3 missing skills.',
      scene4: 'The interview call: sudden breakthrough with top tech firm.',
      scene5: 'The lesson: inspiring others to take the exact same roadmap.',
    },
  },

  pov: {
    id: 'pov',
    name: 'POV (First-Person Experiential)',
    tagline: 'Immersive, highly relatable first-person perspective',
    idealPacing: 'fast_cut',
    targetDurationSec: { min: 15, max: 20 },
    hookStrategy: 'Direct Situation Framing: "POV: You graduated engineering with 0 offers..."',
    narrativeArc: ['The Awkward Setup', 'The Escalating Embarrassment', 'The Sudden Twist', 'The Retaliation / Solution', 'The Final Flex'],
    visualDirection: 'First-person camera perspective, interactive split cards, punch zooms on hilarious reactions.',
    narrationTone: 'Hilarious, self-deprecating, sarcastic, sharp-witted.',
    suitableNiches: ['humor_roasts', 'fresher_careers'],
    recommendedVoices: ['hi-IN-MadhurNeural'],
    storyboardBeats: {
      scene1: 'POV: Your college group chat bragging about 15 LPA packages while you have zero.',
      scene2: 'Your best friend calling to ask if you are opening a chai stall.',
      scene3: 'The revenge twist: finding a verified zero-experience opening dropping today.',
      scene4: 'Applying in 30 seconds before your friend even realizes.',
      scene5: 'The hilarious final flex: comment APPLY and leave the group chat in shock.',
    },
  },

  myth_vs_fact: {
    id: 'myth_vs_fact',
    name: 'Myth vs Fact',
    tagline: 'High-contrast debunking that shatters conventional wisdom',
    idealPacing: 'fast_cut',
    targetDurationSec: { min: 15, max: 20 },
    hookStrategy: 'Belief Destruction: "Stop believing this myth about fresher jobs!"',
    narrativeArc: ['The Common Myth', 'Why Everyone Believes It', 'The Shattering Fact', 'The Proof / Evidence', 'The Smarter Action'],
    visualDirection: 'Split screen, warning red "MYTH" stamp transitioning into vibrant green "FACT" stamp with bold contrast.',
    narrationTone: 'Direct, sharp, eye-opening, confident.',
    suitableNiches: ['fresher_careers', 'salary_reality'],
    recommendedVoices: ['hi-IN-MadhurNeural'],
    storyboardBeats: {
      scene1: 'Red banner: "Myth: You need 3 years of experience for entry-level jobs."',
      scene2: 'Recruiter reality: why HR puts unreasonable filters to stop spam applicants.',
      scene3: 'Green reveal: "Fact: 70% of companies hire if you show 2 verified GitHub projects."',
      scene4: 'The exact framework to bypass the experience requirement.',
      scene5: 'Call to action: save this reel and apply the framework today.',
    },
  },

  top_listicle: {
    id: 'top_listicle',
    name: 'Top 3 / Top 5 Countdown',
    tagline: 'High-energy countdown curation with escalating value',
    idealPacing: 'countdown_beats',
    targetDurationSec: { min: 15, max: 20 },
    hookStrategy: 'Curation Tease: "Top 3 highest paying tech roles hiring freshers with zero DSA!"',
    narrativeArc: ['The Value Hook', 'Item #3 (Solid Entry)', 'Item #2 (Exciting Surprise)', 'Item #1 (The Ultimate Winner)', 'Immediate Action'],
    visualDirection: 'Dynamic numbers (03 -> 02 -> 01), fast kinetic typography, neon badges, vibrant motion graphics.',
    narrationTone: 'High energy, enthusiastic, authoritative curator.',
    suitableNiches: ['fresher_careers', 'salary_reality', 'tech_trends'],
    recommendedVoices: ['hi-IN-MadhurNeural'],
    storyboardBeats: {
      scene1: 'Hook: "Stop grinding 500 LeetCode problems. Here are Top 3 roles hiring right now."',
      scene2: 'Number 3: QA Automation Engineer — Rs. 6 LPA with just Python and Selenium.',
      scene3: 'Number 2: Cloud Support Associate — Rs. 8 LPA with basic AWS knowledge.',
      scene4: 'Number 1: SDE Fresher at fast-growing startups — Rs. 12 LPA with full-stack skills.',
      scene5: 'How to get all 3 direct application links: comment APPLY.',
    },
  },

  tutorial: {
    id: 'tutorial',
    name: 'Tutorial / How-To',
    tagline: 'Actionable step-by-step guidance with clear takeaways',
    idealPacing: 'step_by_step',
    targetDurationSec: { min: 15, max: 20 },
    hookStrategy: 'Problem Solve Promise: "Here is the exact 4-step framework to land an interview in 14 days."',
    narrativeArc: ['The Core Objective', 'Step 1: The Foundation', 'Step 2: The Optimization', 'Step 3: The Outreach', 'The Flawless Outcome'],
    visualDirection: 'Clean step badges (STEP 1, STEP 2), checkmarks, instructional flowcharts, modern UI overlays.',
    narrationTone: 'Encouraging, pragmatic, mentor-like, crystal clear.',
    suitableNiches: ['fresher_careers', 'tech_trends'],
    recommendedVoices: ['hi-IN-MadhurNeural'],
    storyboardBeats: {
      scene1: 'Hook: "If you have 0 callbacks, do these 3 steps today."',
      scene2: 'Step 1: Delete your career objective and replace it with direct GitHub live links.',
      scene3: 'Step 2: Keyword match your resume against the job description with ATS tools.',
      scene4: 'Step 3: Apply within 2 hours of posting on DinoMate for 5x response rate.',
      scene5: 'Summary and encouragement to start applying immediately.',
    },
  },

  news_explainer: {
    id: 'news_explainer',
    name: 'News Explainer',
    tagline: 'Timely headline breakdown with context and insider impact',
    idealPacing: 'measured_documentary',
    targetDurationSec: { min: 15, max: 20 },
    hookStrategy: 'Breaking Alert: "A major shift just happened in tech hiring this week."',
    narrativeArc: ['The Breaking Event', 'The Hidden Reason', 'Who Gets Affected', 'The Silver Lining', 'What To Do Now'],
    visualDirection: 'Ticker style banners, breaking alert badge, digital globe or tech matrix background.',
    narrationTone: 'Journalistic, alert, objective, informative.',
    suitableNiches: ['tech_trends', 'salary_reality'],
    recommendedVoices: ['hi-IN-MadhurNeural'],
    storyboardBeats: {
      scene1: 'Breaking graphic: Big tech announces major campus hiring restructuring.',
      scene2: 'The data: why mass hiring is slowing down but specialist hiring is peaking.',
      scene3: 'What this means for 2025 and 2026 batches.',
      scene4: 'The opportunities opening up in AI engineering and mid-market firms.',
      scene5: 'Where to find these stealth openings daily.',
    },
  },

  before_vs_after: {
    id: 'before_vs_after',
    name: 'Before vs After',
    tagline: 'Stark situational contrast showing real transformation',
    idealPacing: 'fast_cut',
    targetDurationSec: { min: 15, max: 20 },
    hookStrategy: 'Visual Contrast: "Same candidate, 2 completely different outcomes."',
    narrativeArc: ['The Bleak Before', 'The Critical Mistake', 'The Key Pivot', 'The Glowing After', 'The Exact Formula'],
    visualDirection: 'Desaturated, chaotic, red-tinted for Before; crisp, glowing, vibrant blue/green for After.',
    narrationTone: 'Dynamic, persuasive, high contrast, transformational.',
    suitableNiches: ['fresher_careers', 'humor_roasts'],
    recommendedVoices: ['hi-IN-MadhurNeural'],
    storyboardBeats: {
      scene1: 'Before: 300 applications, 0 responses, depression, friend roasts.',
      scene2: 'The error: applying through dead career portals with a 3-page resume.',
      scene3: 'The after: 4 interview calls in 1 week after a 1-page overhaul.',
      scene4: 'Side-by-side comparison of the winning resume layout.',
      scene5: 'Comment RESUME to get the exact clean template.',
    },
  },

  problem_vs_solution: {
    id: 'problem_vs_solution',
    name: 'Problem vs Solution',
    tagline: 'Agitates relatable friction then delivers instant relief',
    idealPacing: 'fast_cut',
    targetDurationSec: { min: 15, max: 20 },
    hookStrategy: 'Pain Agitation: "Are you tired of applying to 100 jobs and hearing nothing back?"',
    narrativeArc: ['The Agonizing Struggle', 'Why Old Methods Fail', 'The Modern Breakthrough', 'How It Works', 'Take Action Now'],
    visualDirection: 'Friction visuals (loading bars, rejected stamps) followed by smooth satisfaction cards and verified checkmarks.',
    narrationTone: 'Empathetic, relieving, triumphant, problem-solving.',
    suitableNiches: ['fresher_careers', 'salary_reality'],
    recommendedVoices: ['hi-IN-MadhurNeural'],
    storyboardBeats: {
      scene1: 'Pain: spending 4 hours filling out repetitive workday application forms.',
      scene2: 'The truth: 80% of those listings are ghost jobs already filled internally.',
      scene3: 'The solution: DinoMate verified fresher radar that filters out ghost listings.',
      scene4: 'Instant 1-click application with verified HR contacts.',
      scene5: 'Save hours every single day: comment APPLY.',
    },
  },

  experiment_challenge: {
    id: 'experiment_challenge',
    name: 'Experiment / Challenge',
    tagline: 'Hypothesis testing with honest behind-the-scenes results',
    idealPacing: 'fast_cut',
    targetDurationSec: { min: 15, max: 20 },
    hookStrategy: 'The Bold Test: "I applied to 50 tech jobs using AI cover letters so you don\'t have to."',
    narrativeArc: ['The Hypothesis & Dare', 'The Setup & Method', 'The Initial Shock', 'The Final Tally', 'The Big Discovery'],
    visualDirection: 'Experiment scoreboard, stopwatch timer, candid reaction shots, test logs.',
    narrationTone: 'Curious, transparent, candid, adventurous.',
    suitableNiches: ['tech_trends', 'fresher_careers', 'humor_roasts'],
    recommendedVoices: ['hi-IN-MadhurNeural'],
    storyboardBeats: {
      scene1: 'The challenge: "Can AI get you a developer job in 2025?"',
      scene2: 'The test: 25 applications with human cold email vs 25 with AI automation.',
      scene3: 'The surprising week 1 results: who actually replied.',
      scene4: 'The unexpected revelation recruiters told me off the record.',
      scene5: 'How you should actually combine AI with real portfolio projects.',
    },
  },

  case_study: {
    id: 'case_study',
    name: 'Case Study',
    tagline: 'Insider strategic breakdown of real career success or failure',
    idealPacing: 'dramatic_build',
    targetDurationSec: { min: 15, max: 20 },
    hookStrategy: 'Unlikely Success: "How a tier-3 non-CS grad cracked a 14 LPA product role in 6 months."',
    narrativeArc: ['The Unfavorable Starting Point', 'The Unconventional Strategy', 'The Key Breakthrough Moment', 'The Exact Playbook', 'How To Replicate'],
    visualDirection: 'Clean corporate minimalism, timeline milestones, salary progression graphs, code repo showcases.',
    narrationTone: 'Strategic, analytical, inspiring, intellectual.',
    suitableNiches: ['fresher_careers', 'salary_reality'],
    recommendedVoices: ['hi-IN-MadhurNeural'],
    storyboardBeats: {
      scene1: 'Candidate profile: 6.2 CGPA, mechanical engineering, 0 on-campus placements.',
      scene2: 'The pivot: dedicating 90 days to building one production-grade full-stack project.',
      scene3: 'The unconventional outreach: sending interactive video demos instead of PDF resumes.',
      scene4: 'The result: 3 competing offers from venture-backed startups.',
      scene5: 'The lesson: proof of work always beats credentials. Comment GUIDE for details.',
    },
  },

  cinematic_narrative: {
    id: 'cinematic_narrative',
    name: 'Cinematic Narrative',
    tagline: 'Atmospheric drama or comedic sketch with dynamic character banter',
    idealPacing: 'conversational_dialogue',
    targetDurationSec: { min: 15, max: 20 },
    hookStrategy: 'Direct Dialogue In-Media-Res: Jump straight into high-stakes or hilarious conversation.',
    narrativeArc: ['Dramatic Confrontation', 'The Uncomfortable Reality', 'The Twist Revelation', 'The Climax Resolution', 'The Witty Punchline'],
    visualDirection: '2.39:1 letterbox or full vertical framing, dramatic chiaroscuro lighting, shallow depth of field, vivid character expressions.',
    narrationTone: 'Dynamic comedic character voices or dramatic dialogue.',
    suitableNiches: ['humor_roasts', 'fresher_careers'],
    recommendedVoices: ['hi-IN-MadhurNeural'],
    storyboardBeats: {
      scene1: 'Friend: "Bhai 4 saal engineering karke finally placement mil gaya!" Me: "Sach me? Kitna mila?"',
      scene2: 'Friend: "12 LPA!" Me: "Whaat! Kahan?" Friend: "LPA matlab Lakhs Per Aadha jeevan... 3.5 LPA hai."',
      scene3: 'Me: "Ruk, DinoMate pe SDE opening aayi hai bina kisi 2 saal bond ke."',
      scene4: 'Checking the requirements together: zero experience, verified package Rs. 8 to 14 LPA.',
      scene5: 'Friend: "Bhai resume bhej jaldi! Dono apply karte hain!" Comment APPLY for direct link.',
    },
  },
};

export interface FormatSelectionCriteria {
  topic: string;
  niche?: string;
  targetAudience?: string;
  recentFormats?: VideoFormatId[];
  preferHumor?: boolean;
}

export interface FormatSelectionResult {
  format: FormatSpecification;
  score: number;
  reason: string;
  alternativeFormats: { formatId: VideoFormatId; score: number }[];
}

/**
 * Intelligent format selection engine that balances topic suitability and anti-fatigue memory.
 */
export function selectVideoFormat(criteria: FormatSelectionCriteria): FormatSelectionResult {
  const { topic, niche = 'fresher_careers', recentFormats = [], preferHumor = false } = criteria;
  const topicLower = topic.toLowerCase();

  const scores: Record<VideoFormatId, number> = {
    mini_documentary: 50,
    storytelling: 55,
    pov: 60,
    myth_vs_fact: 50,
    top_listicle: 55,
    tutorial: 50,
    news_explainer: 45,
    before_vs_after: 50,
    problem_vs_solution: 55,
    experiment_challenge: 45,
    case_study: 50,
    cinematic_narrative: 55,
  };

  // 1. Topic Keyword Affinity
  if (topicLower.includes('roast') || topicLower.includes('friend') || topicLower.includes('no job') || topicLower.includes('meme')) {
    scores.pov += 40;
    scores.cinematic_narrative += 38;
    scores.storytelling += 25;
  }
  if (topicLower.includes('myth') || topicLower.includes('trap') || topicLower.includes('lie') || topicLower.includes('truth')) {
    scores.myth_vs_fact += 45;
    scores.mini_documentary += 30;
  }
  if (topicLower.includes('top') || topicLower.includes('highest') || topicLower.includes('3 ') || topicLower.includes('5 ') || topicLower.includes('roles')) {
    scores.top_listicle += 45;
  }
  if (topicLower.includes('how to') || topicLower.includes('step') || topicLower.includes('roadmap') || topicLower.includes('guide')) {
    scores.tutorial += 45;
    scores.problem_vs_solution += 25;
  }
  if (topicLower.includes('breaking') || topicLower.includes('surge') || topicLower.includes('shift') || topicLower.includes('mass hiring')) {
    scores.news_explainer += 40;
    scores.mini_documentary += 25;
  }
  if (topicLower.includes('before') || topicLower.includes('after') || topicLower.includes('0 vs') || topicLower.includes('mistake')) {
    scores.before_vs_after += 40;
    scores.problem_vs_solution += 30;
  }
  if (topicLower.includes('case') || topicLower.includes('how a') || topicLower.includes('cracked')) {
    scores.case_study += 45;
    scores.storytelling += 25;
  }
  if (topicLower.includes('test') || topicLower.includes('experiment') || topicLower.includes('tried') || topicLower.includes('applied to')) {
    scores.experiment_challenge += 45;
  }

  // 2. Humor Preference
  if (preferHumor || niche === 'humor_roasts') {
    scores.pov += 25;
    scores.cinematic_narrative += 25;
    scores.storytelling += 15;
  }

  // 3. Niche Suitability
  for (const [id, spec] of Object.entries(FORMAT_REGISTRY)) {
    if (spec.suitableNiches.includes(niche)) {
      scores[id as VideoFormatId] += 15;
    }
  }

  // 4. Anti-Fatigue / Content Diversity Penalties
  // Heavily penalize formats recently used to guarantee variation across consecutive uploads
  if (recentFormats.length > 0) {
    const lastFormat = recentFormats[recentFormats.length - 1];
    if (scores[lastFormat]) {
      scores[lastFormat] -= 55; // Never repeat the exact same format back-to-back
    }

    if (recentFormats.length > 1) {
      const secondLast = recentFormats[recentFormats.length - 2];
      if (scores[secondLast]) {
        scores[secondLast] -= 30;
      }
    }

    if (recentFormats.length > 2) {
      const thirdLast = recentFormats[recentFormats.length - 3];
      if (scores[thirdLast]) {
        scores[thirdLast] -= 15;
      }
    }
  }

  // Rank formats
  const sorted = (Object.keys(scores) as VideoFormatId[]).sort((a, b) => scores[b] - scores[a]);
  const bestFormatId = sorted[0];
  const bestFormat = FORMAT_REGISTRY[bestFormatId];

  return {
    format: bestFormat,
    score: scores[bestFormatId],
    reason: `Selected "${bestFormat.name}" (${bestFormatId}) with score ${scores[bestFormatId]} based on topic keywords and diversity rotation against recent uploads [${recentFormats.slice(-3).join(', ')}].`,
    alternativeFormats: sorted.slice(1, 4).map((id) => ({ formatId: id, score: scores[id] })),
  };
}

