/**
 * Idea Forge — turns raw trend signals into a FRESH video idea every run.
 *
 * Why: the old pipeline always picked trends[0] (usually a hardcoded "curated"
 * topic), so videos repeated. Here we:
 *   1. mix live signals with a broad, rotating set of content pillars,
 *   2. ask the LLM for several distinct ideas (each with a delivery mode),
 *   3. score every idea against content memory and pick the most novel one
 *      (with a bit of randomness), never repeating the last mode/pillar.
 */

import { executeLLM } from '../litellm';
import { TrendEvidence } from './trend-discovery';
import { evaluateIdeaSimilarity, getRecentMemories } from '../variety/content-memory';

export type DeliveryMode = 'guide' | 'skit' | 'voiceover';
export type SetSetting = 'studio' | 'office' | 'canteen' | 'hostel' | 'interview' | 'tapri' | 'abstract';

export interface VideoIdea {
  title: string; // working title
  angle: string; // the specific, non-generic take
  pillar: string;
  mode: DeliveryMode;
  setting: SetSetting;
  castCount: number; // 0 for voiceover, 1 for guide, 2-3 for skit
  castRoles: string[];
  whyNow: string;
  trendId?: string;
  trendTopic?: string;
  sourceUrl?: string;
  novelty?: number; // 0..1, higher = fresher
}

/** Broad pillars so content is generalised, not stuck on one template. */
export const CONTENT_PILLARS = [
  'job hunt & off-campus hiring',
  'interview fails and how to fix them',
  'salary, CTC, in-hand and negotiation',
  'workplace / corporate comedy',
  'college & hostel life comedy',
  'AI tools that save hours (practical demo-style tips)',
  'tech news explained simply',
  'resume & LinkedIn mistakes',
  'first-job money basics (tax, savings, SIP)',
  'coding & DSA shortcuts',
  'startup vs MNC reality',
  'productivity & focus hacks for students',
  'remote work / internships',
  'parents & relatives vs career choices (comedy)',
  'myths about tech careers',
  'soft skills: communication, email, meetings',
];

const SETTINGS_BY_MODE: Record<DeliveryMode, SetSetting[]> = {
  guide: ['studio', 'office', 'studio', 'hostel'],
  skit: ['canteen', 'office', 'hostel', 'interview', 'tapri'],
  voiceover: ['abstract'],
};

function brandContext() {
  return (
    process.env.CONTENT_BRAND_CONTEXT ||
    'DinoMate (dinomate.app) — a platform that lists verified entry-level / fresher jobs for Indian students and early-career folks.'
  );
}

function audience() {
  return process.env.CONTENT_AUDIENCE || 'Indian college students, freshers and early-career professionals (18-27)';
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normaliseIdea(raw: any, trends: TrendEvidence[]): VideoIdea | null {
  if (!raw || typeof raw !== 'object') return null;
  const mode: DeliveryMode = ['guide', 'skit', 'voiceover'].includes(raw.mode) ? raw.mode : 'guide';
  const allowed = SETTINGS_BY_MODE[mode];
  const setting: SetSetting = allowed.includes(raw.setting) ? raw.setting : allowed[Math.floor(Math.random() * allowed.length)];
  const castCount = mode === 'voiceover' ? 0 : mode === 'guide' ? 1 : Math.min(3, Math.max(2, Number(raw.castCount) || 2));
  const title = String(raw.title || '').trim();
  const angle = String(raw.angle || '').trim();
  if (title.length < 6 || angle.length < 10) return null;
  const trend = typeof raw.trendIndex === 'number' ? trends[raw.trendIndex] : undefined;
  return {
    title: title.slice(0, 120),
    angle: angle.slice(0, 300),
    pillar: String(raw.pillar || 'general').slice(0, 80),
    mode,
    setting,
    castCount,
    castRoles: Array.isArray(raw.castRoles) ? raw.castRoles.map(String).slice(0, castCount) : [],
    whyNow: String(raw.whyNow || '').slice(0, 200),
    trendId: trend?.id,
    trendTopic: trend?.topic,
    sourceUrl: trend?.sourceUrl,
  };
}

/** Deterministic-free fallback: combinatorial idea generator (no LLM needed). */
function fallbackIdeas(trends: TrendEvidence[], wantedModes: DeliveryMode[]): VideoIdea[] {
  const skitPremises = [
    { t: 'When HR asks "Expected CTC?"', a: 'Fresher says a number, HR reacts, fresher panics and negotiates down against himself — then the senior shows how to answer properly.', roles: ['struggling fresher', 'savage HR'], s: 'interview' as SetSetting },
    { t: 'Relative asks "Beta package kitna hai?"', a: 'Aunty compares with Sharma ji ka beta; fresher explains CTC vs in-hand and wins the argument with a twist.', roles: ['struggling fresher', 'desi mom relative'], s: 'tapri' as SetSetting },
    { t: 'Manager: "Quick call, 5 minutes"', a: 'The 5-minute call becomes 2 hours; intern learns the art of the polite meeting exit.', roles: ['struggling fresher', 'clueless corporate manager'], s: 'office' as SetSetting },
    { t: 'Roommate discovers you use AI for everything', a: 'Roommate roasts you for using ChatGPT to reply to mom, then secretly asks how to use it for his resume.', roles: ['chill hostel roommate', 'smart topper friend'], s: 'hostel' as SetSetting },
    { t: '"Entry level" job needs 5 years experience', a: 'Friends read a ridiculous JD out loud, roast it, then find a genuinely zero-experience role.', roles: ['sarcastic best friend', 'struggling fresher'], s: 'canteen' as SetSetting },
  ];
  const guideTopics = [
    { t: '3 lines that make HR shortlist your resume', a: 'Concrete before/after bullet rewrites with numbers instead of duties.' },
    { t: 'CTC vs in-hand: why 6 LPA is not 50k a month', a: 'Break down PF, tax, variable pay with simple math.' },
    { t: 'The 30-second answer to "Tell me about yourself"', a: 'Present-past-future formula with an example answer.' },
    { t: '3 free AI tools every fresher should use this week', a: 'One tool each for resume, interview practice, and learning — with exact use-case.' },
    { t: 'How to cold message a recruiter on LinkedIn', a: 'A 3-line template that gets replies, and the 2 lines that get you ignored.' },
  ];
  const voTopics = [
    { t: 'Why 90% of resumes are rejected in 6 seconds', a: 'What recruiters actually scan for, in the order they scan it.' },
    { t: 'The hidden cost of a 2-year service bond', a: 'Opportunity-cost math most freshers never do.' },
    { t: 'What this week\'s tech layoffs mean for freshers', a: 'Which roles are still hiring and why.' },
  ];

  const ideas: VideoIdea[] = [];
  for (const p of shuffle(skitPremises).slice(0, 2)) {
    ideas.push({ title: p.t, angle: p.a, pillar: 'comedy', mode: 'skit', setting: p.s, castCount: 2, castRoles: p.roles, whyNow: 'evergreen relatable' });
  }
  for (const g of shuffle(guideTopics).slice(0, 2)) {
    ideas.push({ title: g.t, angle: g.a, pillar: 'career guide', mode: 'guide', setting: shuffle(SETTINGS_BY_MODE.guide)[0], castCount: 1, castRoles: ['friendly mentor'], whyNow: 'evergreen value' });
  }
  for (const v of shuffle(voTopics).slice(0, 1)) {
    ideas.push({ title: v.t, angle: v.a, pillar: 'explainer', mode: 'voiceover', setting: 'abstract', castCount: 0, castRoles: [], whyNow: 'evergreen' });
  }
  // live trend-based ideas
  for (const t of trends.filter((x) => x.source !== 'curated_radar').slice(0, 2)) {
    ideas.push({
      title: t.topic.slice(0, 90),
      angle: `Explain what "${t.topic.slice(0, 80)}" means for freshers in plain words, with one action they can take today.`,
      pillar: 'tech news explained simply',
      mode: wantedModes[0] || 'voiceover',
      setting: 'abstract',
      castCount: wantedModes[0] === 'skit' ? 2 : wantedModes[0] === 'guide' ? 1 : 0,
      castRoles: [],
      whyNow: t.summary.slice(0, 160),
      trendId: t.id,
      trendTopic: t.topic,
      sourceUrl: t.sourceUrl,
    });
  }
  return ideas.map((i) =>
    i.mode === 'voiceover' ? i : { ...i, setting: i.setting === 'abstract' ? SETTINGS_BY_MODE[i.mode][0] : i.setting }
  );
}

export interface ForgeOptions {
  trends: TrendEvidence[];
  forcedMode?: DeliveryMode;
  runId?: string;
  ideaCount?: number;
}

/**
 * Produce the freshest idea for this run.
 */
export async function forgeFreshIdea(opts: ForgeOptions): Promise<{ idea: VideoIdea; candidates: VideoIdea[] }> {
  const { trends, forcedMode, runId } = opts;
  const recent = await getRecentMemories(25);
  const lastModes = recent.map((m: any) => m.archetype).filter(Boolean) as string[];
  const recentTopics = recent.map((m: any) => `- ${m.topic} [${m.archetype || m.formatType}]`).slice(0, 20);

  // Mode rotation: avoid repeating the last mode unless forced.
  const modeWeights: Record<DeliveryMode, number> = { skit: 0.42, guide: 0.33, voiceover: 0.25 };
  if (lastModes[0] && lastModes[0] in modeWeights) modeWeights[lastModes[0] as DeliveryMode] *= 0.25;
  const wantedModes: DeliveryMode[] = forcedMode
    ? [forcedMode]
    : (Object.keys(modeWeights) as DeliveryMode[]).sort((a, b) => modeWeights[b] * Math.random() - modeWeights[a] * Math.random());

  const pillars = shuffle(CONTENT_PILLARS).slice(0, 6);
  const signals = trends
    .slice(0, 10)
    .map((t, i) => `[${i}] (${t.source}) ${t.topic} — ${t.summary.slice(0, 140)}`)
    .join('\n');

  let candidates: VideoIdea[] = [];
  try {
    const res = await executeLLM<{ ideas: any[] }>({
      alias: 'writer',
      jsonMode: true,
      temperature: 0.95,
      maxTokens: 3000,
      timeoutMs: 60000,
      runId,
      messages: [
        {
          role: 'system',
          content: `You are the head of content for a fast-growing short-video channel.
Brand: ${brandContext()}
Audience: ${audience()}
You invent SPECIFIC, surprising, highly shareable Reels/Shorts ideas. Never generic ("tips for freshers" is banned).
Each idea must have a concrete angle: a scenario, a number, a contrarian claim, or a named situation everyone has lived through.
Delivery modes:
- "skit": 2-3 animated characters act out a funny relatable scene with a punchline (comedy first, value second).
- "guide": one animated presenter talks to camera like a friendly mentor giving a quick, concrete how-to.
- "voiceover": narrator voice only over visuals; best for explainers, news, myth-busting, data stories.
Settings: skit -> canteen|office|hostel|interview|tapri ; guide -> studio|office|hostel ; voiceover -> abstract.
Return JSON only.`,
        },
        {
          role: 'user',
          content: `LIVE SIGNALS (use some, ignore weak ones):
${signals || '(none available)'}

PILLARS TO EXPLORE THIS TIME: ${pillars.join('; ')}

ALREADY POSTED RECENTLY (do NOT repeat these topics, hooks or jokes):
${recentTopics.join('\n') || '(nothing yet)'}

Preferred modes in order: ${wantedModes.join(', ')}${forcedMode ? ` (ONLY use "${forcedMode}")` : ''}.

Return {"ideas":[...]} with ${opts.ideaCount || 6} DIFFERENT ideas, each:
{"title": "...", "angle": "the specific take / scenario / punchline in 1-2 sentences", "pillar": "...",
 "mode": "skit|guide|voiceover", "setting": "...", "castCount": 1-3, "castRoles": ["sarcastic best friend", "savage HR", ...],
 "whyNow": "why people will care this week", "trendIndex": <index of signal used or null>}`,
        },
      ],
    });
    const raw = (res.data as any)?.ideas || [];
    candidates = raw.map((r: any) => normaliseIdea(r, trends)).filter(Boolean) as VideoIdea[];
  } catch (err: any) {
    console.warn('[IdeaForge] LLM idea generation failed, using combinatorial fallback:', err.message);
  }

  if (candidates.length < 2) candidates = candidates.concat(fallbackIdeas(trends, wantedModes));
  if (forcedMode) {
    const filtered = candidates.filter((c) => c.mode === forcedMode);
    candidates = filtered.length ? filtered : candidates.map((c) => normaliseIdea({ ...c, mode: forcedMode }, trends)!).filter(Boolean);
  }

  // Novelty scoring vs content memory
  for (const c of candidates) {
    try {
      const sim = await evaluateIdeaSimilarity({
        topic: c.title,
        hookText: c.angle,
        uniqueAngle: c.angle,
        formatType: c.mode,
        archetype: c.mode,
      });
      let novelty = 1 - Math.max(sim.topicSimilarity, sim.hookSimilarity);
      if (sim.isDuplicate) novelty *= 0.2;
      if (lastModes[0] === c.mode && !forcedMode) novelty *= 0.7;
      c.novelty = Number(novelty.toFixed(3));
    } catch {
      c.novelty = 0.5;
    }
  }

  // Weighted random among the top 3 most novel, so runs don't become predictable.
  const ranked = [...candidates].sort((a, b) => (b.novelty || 0) - (a.novelty || 0));
  const top = ranked.slice(0, 3);
  const weights = top.map((c, i) => (c.novelty || 0.1) * [1, 0.7, 0.5][i]);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  let r = Math.random() * sum;
  let chosen = top[0];
  for (let i = 0; i < top.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      chosen = top[i];
      break;
    }
  }
  return { idea: chosen, candidates: ranked };
}
