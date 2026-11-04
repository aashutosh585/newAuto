/**
 * Script Director — writes the actual spoken script for a reel in one of 3 modes:
 *   skit      : multi-character comedy dialogue with setup -> escalation -> punchline -> value
 *   guide     : one presenter talking to camera, concrete steps, human tone
 *   voiceover : narrator only, story/explainer style
 *
 * Output lines carry acting directions (emotion, gesture, listener reaction, sfx,
 * on-screen sticker text) that the renderer turns into animation.
 */

import { executeLLM } from '../litellm';
import { VideoIdea, DeliveryMode } from '../trend/idea-forge';
import { CastMember } from './cast';

export const EMOTIONS = ['neutral', 'happy', 'laughing', 'shocked', 'sarcastic', 'sad', 'angry', 'confident', 'thinking'] as const;
export const GESTURES = ['idle', 'explain', 'both_explain', 'count', 'point_up', 'point_side', 'point_viewer', 'shrug', 'facepalm', 'laugh', 'cross', 'think', 'wave', 'celebrate', 'thumbs_up', 'hands_on_hips'] as const;
export const SFX = ['haha', 'bruh', 'boom', 'ding', 'record_scratch', 'wow', 'oof', 'facts'] as const;

export type Emotion = (typeof EMOTIONS)[number];
export type Gesture = (typeof GESTURES)[number];

export interface ScriptLine {
  speaker: string; // cast id (c1, c2...) or "narrator"
  text: string; // Roman script — used for captions
  spoken?: string; // Devanagari-Hinglish (Hindi words in Devanagari, English words in Latin) — read by hi-IN voices
  emoji?: string;
  emotion: Emotion;
  gesture?: Gesture;
  listenerReaction?: Emotion;
  onScreen?: string;
  sfx?: (typeof SFX)[number];
  punchline?: boolean;
  pauseAfter?: number;
}

export interface ReelScript {
  mode: DeliveryMode;
  title: string; // on-screen hook card
  lines: ScriptLine[];
  caption: string;
  hashtags: string[];
  cta: string;
}

function language(): string {
  const l = (process.env.CONTENT_LANGUAGE || 'hinglish').toLowerCase();
  if (l === 'english') return 'Natural Indian English, casual and conversational.';
  if (l === 'hindi') return 'Conversational Hindi written in ROMAN script (no Devanagari), English tech terms kept in English.';
  return 'Hinglish written in ROMAN script (no Devanagari): the way young Indians actually talk — Hindi sentence flow with English words for tech/career terms. Example: "Bhai, resume mein sirf duties likhoge toh HR skip kar dega."';
}

const INDIAN_STYLE = `DESI REEL STYLE (this is what Indian audiences love — follow it):
- Feels like the best Indian Instagram creators: everyday desi situations, exaggerated but believable reactions, family & friends dynamics.
- Use relatable desi tropes naturally (pick 1-2, never all): mummy/papa ka taana, Sharma ji ka beta, relatives at a shaadi asking "package kitna hai", hostel maggi at 2 AM, cutting chai, jugaad, last-bench friend, placement cell, "beta engineering kar lo", cricket references, EMI, WhatsApp uncle forwards, Bangalore traffic, notice period.
- Natural Hinglish fillers & expressions: "arre", "yaar", "bhai", "matlab", "sun na", "scene kya hai", "kya baat hai", "chal hatt", "bas kar", "pakka?", "sach mein?".
- Hooks Indians stop scrolling for: "POV:", "Har ghar ki kahani", "Ye galti mat karna", "Wait for the end", "Middle class wale relate karenge", "Interview mein ye bola toh...".
- Ending: a twist or relatable punch + comment-bait like "Tag that friend jo..." or "Comment karo agar tumhare saath bhi hua".
- Respectful humour: roast situations, never religion/caste/region/gender.`;

const MODE_RULES: Record<DeliveryMode, string> = {
  skit: `SKIT RULES:
- 7 to 11 lines of dialogue between the characters. Lines are SHORT (3-14 words), like real people talking, with interruptions and reactions ("Kya?!", "Ruk ruk ruk", "Bhai...").
- Structure: relatable setup (line 1 must hook in <2s) -> escalation -> PUNCHLINE (mark "punchline": true, add an sfx) -> one genuinely useful takeaway -> quick closing joke / CTA.
- Each character has a distinct personality matching their role. Comedy comes from character, exaggeration and specificity, not from saying "funny".
- Use "listenerReaction" so the other character visibly reacts (laughing, shocked, sad, sarcastic...).`,
  guide: `GUIDE RULES:
- One presenter (speaker "c1") talks straight to camera like a friend who knows the answer. 6 to 9 lines.
- Line 1: a pattern-interrupt hook (bold claim, surprising number, or "Stop doing X").
- Then concrete, specific steps/examples (real numbers, real phrases to say, real tool names). No vague advice.
- Add 1 light joke or self-aware aside so it feels human. End with a one-line CTA.
- Use gestures: "count" when listing, "point_up" for key insight, "explain" otherwise, "shrug" for "sounds obvious, right?".`,
  voiceover: `VOICEOVER RULES:
- Narrator only (speaker "narrator"). 6 to 9 lines. Storytelling cadence: hook -> context -> reveal -> what to do.
- Write for the EAR: short sentences, rhetorical questions, one surprising fact/number.
- Every line gets an "onScreen" text (2-5 words, punchy) because visuals are text-driven.`,
};

function sanitize(script: any, mode: DeliveryMode, cast: CastMember[], idea: VideoIdea): ReelScript | null {
  if (!script || !Array.isArray(script.lines)) return null;
  const ids = new Set(cast.map((c) => c.id));
  const nameToId = new Map(cast.map((c) => [c.name.toLowerCase(), c.id]));
  const lines: ScriptLine[] = [];
  for (const raw of script.lines) {
    let text = String(raw?.text || '')
      .replace(/[ऀ-ॿ]+/g, '') // strip Devanagari: captions must stay Roman
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/\*|_|#/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) continue;
    let speaker = String(raw?.speaker || '').trim();
    if (mode === 'voiceover') speaker = 'narrator';
    else if (!ids.has(speaker)) speaker = nameToId.get(speaker.toLowerCase()) || cast[lines.length % Math.max(1, cast.length)]?.id || 'c1';
    if (mode === 'guide') speaker = cast[0]?.id || 'c1';
    const emotion = (EMOTIONS as readonly string[]).includes(raw?.emotion) ? raw.emotion : 'neutral';
    const gesture = (GESTURES as readonly string[]).includes(raw?.gesture) ? raw.gesture : undefined;
    const reaction = (EMOTIONS as readonly string[]).includes(raw?.listenerReaction) ? raw.listenerReaction : undefined;
    const sfx = (SFX as readonly string[]).includes(raw?.sfx) ? raw.sfx : undefined;
    const onScreen = raw?.onScreen ? String(raw.onScreen).slice(0, 48).trim() : undefined;
    let spoken = String(raw?.spoken || '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/\*|_|#/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!/[\u0900-\u097F]/.test(spoken)) spoken = ''; // must actually contain Devanagari
    const emojiMatch = String(raw?.emoji || '').match(/\p{Extended_Pictographic}/u);
    lines.push({
      speaker,
      text: text.slice(0, 220),
      spoken: spoken ? spoken.slice(0, 260) : undefined,
      emoji: emojiMatch ? emojiMatch[0] : undefined,
      emotion,
      gesture,
      listenerReaction: reaction,
      onScreen: onScreen || undefined,
      sfx,
      punchline: !!raw?.punchline,
      pauseAfter: raw?.punchline ? 0.55 : undefined,
    });
  }
  const words = lines.reduce((n, l) => n + l.text.split(/\s+/).length, 0);
  if (lines.length < 4 || words < 30) return null;
  // trim overly long scripts (keep first + last lines) to stay under ~55s
  while (lines.reduce((n, l) => n + l.text.split(/\s+/).length, 0) > 90 && lines.length > 5) {
    lines.splice(lines.length - 2, 1);
  }
  const hashtags: string[] = (Array.isArray(script.hashtags) ? script.hashtags : [])
    .map((h: any) => '#' + String(h).replace(/^#/, '').replace(/\s+/g, ''))
    .filter((h: string) => h.length > 2)
    .slice(0, 8);
  return {
    mode,
    title: String(script.title || idea.title).slice(0, 70),
    lines,
    caption: String(script.caption || idea.title).slice(0, 1800),
    hashtags: hashtags.length ? hashtags : ['#freshers', '#careertips', '#jobs', '#dinomate'],
    cta: String(script.cta || 'Link in bio > dinomate.app').slice(0, 40),
  };
}

function fallbackScript(idea: VideoIdea, cast: CastMember[]): ReelScript {
  const a = cast[0]?.id || 'c1';
  const b = cast[1]?.id || a;
  if (idea.mode === 'skit') {
    return {
      mode: 'skit',
      title: idea.title,
      lines: [
        { speaker: a, text: 'Bhai, 200 jagah apply kiya. Ek bhi call nahi aaya.', emotion: 'sad', gesture: 'facepalm', listenerReaction: 'thinking' },
        { speaker: b, text: 'Resume dikha zara.', emotion: 'thinking', gesture: 'think', listenerReaction: 'neutral' },
        { speaker: a, text: 'Ye dekh. Objective: to work in a reputed organisation.', emotion: 'confident', gesture: 'explain', listenerReaction: 'shocked' },
        { speaker: b, text: 'Bhai ye line toh 2009 se har resume mein hai.', emotion: 'sarcastic', gesture: 'cross', listenerReaction: 'sad', punchline: true, sfx: 'bruh' },
        { speaker: a, text: 'Toh kya likhun phir?', emotion: 'shocked', gesture: 'shrug', listenerReaction: 'confident' },
        { speaker: b, text: 'Objective hata. Ek project likh, number ke saath. Built X, used by 500 users.', emotion: 'confident', gesture: 'count', onScreen: 'PROJECT + NUMBERS', listenerReaction: 'thinking' },
        { speaker: a, text: 'Aur skills mein MS Word?', emotion: 'thinking', gesture: 'think', listenerReaction: 'laughing' },
        { speaker: b, text: 'Bhai please. Verified fresher jobs ke liye link bio mein hai.', emotion: 'laughing', gesture: 'laugh', listenerReaction: 'happy', sfx: 'haha' },
      ],
      caption: `${idea.title}\n\nSave this before your next application.`,
      hashtags: ['#resume', '#freshers', '#placement', '#jobsearch', '#dinomate'],
      cta: 'Link in bio > dinomate.app',
    };
  }
  if (idea.mode === 'guide') {
    return {
      mode: 'guide',
      title: idea.title,
      lines: [
        { speaker: a, text: 'Agar tumhara resume 6 second mein reject ho raha hai, toh ye suno.', emotion: 'confident', gesture: 'point_up', onScreen: '6 SECOND RULE' },
        { speaker: a, text: 'Pehla: top pe objective nahi, ek line summary. Role plus skill plus proof.', emotion: 'neutral', gesture: 'count', onScreen: '1. ONE-LINE SUMMARY' },
        { speaker: a, text: 'Doosra: har project mein ek number. Users, speed, ya accuracy.', emotion: 'happy', gesture: 'count', onScreen: '2. ADD NUMBERS' },
        { speaker: a, text: 'Teesra: skills mein sirf woh jo interview mein defend kar sako.', emotion: 'sarcastic', gesture: 'shrug', onScreen: '3. DEFENDABLE SKILLS' },
        { speaker: a, text: 'MS Word likhna band karo, please. Hum 2025 mein hain.', emotion: 'laughing', gesture: 'laugh', sfx: 'haha' },
        { speaker: a, text: 'Verified fresher jobs chahiye? Link bio mein hai.', emotion: 'happy', gesture: 'wave' },
      ],
      caption: `${idea.title}\n\nSave it. Share it with that one friend.`,
      hashtags: ['#resume', '#freshers', '#careertips', '#dinomate'],
      cta: 'Link in bio > dinomate.app',
    };
  }
  return {
    mode: 'voiceover',
    title: idea.title,
    lines: [
      { speaker: 'narrator', text: 'Ek recruiter tumhara resume sirf 6 second dekhta hai.', emotion: 'neutral', onScreen: '6 SECONDS' },
      { speaker: 'narrator', text: 'Aur un 6 second mein woh sirf teen cheezein dhoondta hai.', emotion: 'neutral', onScreen: 'ONLY 3 THINGS' },
      { speaker: 'narrator', text: 'Tumhara latest role ya project.', emotion: 'neutral', onScreen: '1. LATEST WORK' },
      { speaker: 'narrator', text: 'Koi bhi number jo impact dikhaye.', emotion: 'neutral', onScreen: '2. IMPACT NUMBERS' },
      { speaker: 'narrator', text: 'Aur woh skills jo job description se match karein.', emotion: 'neutral', onScreen: '3. MATCHING SKILLS' },
      { speaker: 'narrator', text: 'Baaki sab? Skip. Verified fresher jobs ke liye link bio mein.', emotion: 'neutral', onScreen: 'LINK IN BIO', punchline: true, sfx: 'ding' },
    ],
    caption: `${idea.title}\n\nFollow for more no-fluff career breakdowns.`,
    hashtags: ['#resume', '#freshers', '#jobsearch', '#dinomate'],
    cta: 'Link in bio > dinomate.app',
  };
}

/**
 * Second, small LLM pass: convert Roman Hinglish lines into "voice-actor" text —
 * Hindi words in Devanagari, English words left in English, numbers spoken the Indian way.
 * hi-IN neural voices read this with a natural desi accent. Failure is non-fatal
 * (the TTS worker falls back to its rule-based transliterator).
 */
async function addSpokenHindi(script: ReelScript, runId?: string): Promise<void> {
  const texts = script.lines.map((l) => l.text);
  try {
    const res = await executeLLM<{ spoken: string[] }>({
      alias: 'writer',
      jsonMode: true,
      temperature: 0.2,
      maxTokens: 2000,
      timeoutMs: 45000,
      runId,
      messages: [
        {
          role: 'system',
          content: `You prepare Hinglish dialogue for an Indian Hindi voice actor (TTS).
For each input line return the SAME words: Hindi words written in Devanagari, English words kept in English (Latin) letters, numbers written as words the way an Indian says them ("6 LPA" -> "छह LPA", "500" -> "पाँच सौ", "2 AM" -> "रात के दो बजे").
Keep punctuation for natural pauses. Do not translate, add or drop words. Return JSON only: {"spoken": ["...", ...]} with exactly ${texts.length} items.
Example: "Bhai, resume mein sirf duties likhoge toh HR skip kar dega." -> "भाई, resume में सिर्फ duties लिखोगे तो HR skip कर देगा।"`,
        },
        { role: 'user', content: JSON.stringify(texts) },
      ],
    });
    const out = (res.data as any)?.spoken;
    if (!Array.isArray(out) || out.length !== texts.length) throw new Error('length mismatch');
    out.forEach((sp: any, i: number) => {
      const v = String(sp || '').replace(/\s+/g, ' ').trim();
      if (/[\u0900-\u097F]/.test(v)) script.lines[i].spoken = v.slice(0, 260);
    });
  } catch (err: any) {
    console.warn('[ScriptDirector] Devanagari voice pass failed (using rule-based transliteration):', err.message);
  }
}

export async function directScript(idea: VideoIdea, cast: CastMember[], runId?: string): Promise<ReelScript> {
  const castDesc = cast.map((c) => `- ${c.id}: ${c.name} (${c.gender === 'm' ? 'male' : 'female'}) — ${c.role}`).join('\n');
  const brand = process.env.CONTENT_BRAND_CONTEXT || 'DinoMate (dinomate.app) — verified fresher / entry-level jobs for Indian students.';

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await executeLLM<any>({
        alias: 'writer',
        jsonMode: true,
        temperature: attempt === 0 ? 0.9 : 0.7,
        maxTokens: 2500,
        timeoutMs: 70000,
        runId,
        messages: [
          {
            role: 'system',
            content: `You are a top Indian short-form comedy & education scriptwriter (think the best Instagram Reels creators).
You write scripts that sound like REAL humans talking — natural rhythm, fillers where natural ("matlab", "yaar", "suno"), contractions, reactions.
LANGUAGE: ${language()}
"text" is ALWAYS Roman script (it becomes the on-screen captions). No emojis/hashtags inside "text".
"emoji": one fitting emoji per line (😂 😳 🤦 💀 🔥 😤 🙄 🤔 ✅ ❌ 💰 📈), shown with captions.
${INDIAN_STYLE}
Brand (mention naturally ONLY at the end, never salesy): ${brand}
Target length: ${idea.mode === 'skit' ? '25-38' : '20-35'} seconds of speech (HARD LIMIT: ${idea.mode === 'skit' ? '60-85' : '50-75'} words total across all lines). Tight is better than long.
FACTS: never invent dates, numbers, names or events. For news/trend topics use ONLY facts stated in the SOURCE SIGNAL; if unsure, speak generally ("recently", "reports say").
${MODE_RULES[idea.mode]}
Allowed emotion: ${EMOTIONS.join('|')}
Allowed gesture: ${GESTURES.join('|')}
Allowed sfx: ${SFX.join('|')}
Return JSON only.`,
          },
          {
            role: 'user',
            content: `IDEA: ${idea.title}
ANGLE: ${idea.angle}
WHY NOW: ${idea.whyNow || '-'}
${idea.trendTopic ? `SOURCE SIGNAL: ${idea.trendTopic}` : ''}
SETTING: ${idea.setting}
${idea.mode === 'voiceover' ? 'SPEAKER: narrator' : `CAST:\n${castDesc}`}

Return:
{"title": "on-screen hook, max 8 words, desi curiosity hook, may end with 1 emoji",
 "lines": [{"speaker": "${idea.mode === 'voiceover' ? 'narrator' : 'c1'}", "text": "Roman Hinglish", "emoji": "😂", "emotion": "...", "gesture": "...",
            "listenerReaction": "...", "onScreen": "optional 2-5 word sticker", "sfx": "optional", "punchline": false}],
 "caption": "Instagram caption, 2-4 short lines, ends with a question to drive comments",
 "hashtags": ["5-8 relevant hashtags"],
 "cta": "max 5 words for the end button"}`,
          },
        ],
      });
      const s = sanitize(res.data, idea.mode, cast, idea);
      if (!s) console.warn(`[ScriptDirector] rejected output from ${res.model}: ${String(res.text).slice(0, 600)}`);
      if (s) {
        if (process.env.CONTENT_LANGUAGE?.toLowerCase() !== 'english') await addSpokenHindi(s, runId);
        return s;
      }
      console.warn('[ScriptDirector] LLM script failed validation, retrying...');
    } catch (err: any) {
      console.warn('[ScriptDirector] LLM error:', err.message);
    }
  }
  console.warn('[ScriptDirector] Using built-in fallback script.');
  const fb = fallbackScript(idea, cast);
  if (process.env.CONTENT_LANGUAGE?.toLowerCase() !== 'english') await addSpokenHindi(fb, runId);
  return fb;
}
