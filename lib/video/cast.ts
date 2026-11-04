/**
 * Character & voice library for animated reels.
 * Each run samples a fresh cast so faces, outfits and voices vary video-to-video.
 */

export type Gender = 'm' | 'f';

export interface CastMember {
  id: string;
  name: string;
  gender: Gender;
  role: string; // persona hint for the script writer
  skin: string;
  hair: string;
  hairStyle: 'short' | 'spiky' | 'long' | 'bun' | 'curly' | 'bald' | 'ponytail';
  shirt: string;
  shirtStyle: 'tshirt' | 'hoodie' | 'shirt' | 'blazer' | 'kurta';
  accessory: 'none' | 'glasses' | 'headphones' | 'beard' | 'cap' | 'bindi' | 'lanyard';
  facialHair?: 'none' | 'stubble' | 'moustache' | 'beard';
  earrings?: boolean;
  voice: string; // edge-tts voice
  rate: string;
  pitch: string;
  elevenVoiceId?: string; // optional premium voice
}

interface Persona {
  role: string;
  gender: Gender;
  outfit: CastMember['shirtStyle'][];
  accessory: CastMember['accessory'][];
  hair: CastMember['hairStyle'][];
}

const PERSONAS: Persona[] = [
  { role: 'sarcastic best friend who roasts everyone', gender: 'm', outfit: ['hoodie', 'tshirt'], accessory: ['headphones', 'cap', 'none'], hair: ['spiky', 'short', 'curly'] },
  { role: 'struggling fresher, relatable and dramatic', gender: 'm', outfit: ['tshirt', 'hoodie'], accessory: ['none', 'glasses'], hair: ['short', 'curly'] },
  { role: 'smart topper friend who has the answers', gender: 'f', outfit: ['kurta', 'shirt'], accessory: ['glasses', 'bindi', 'none'], hair: ['long', 'bun', 'ponytail'] },
  { role: 'savage HR / interviewer', gender: 'f', outfit: ['blazer', 'shirt'], accessory: ['glasses', 'lanyard'], hair: ['bun', 'long'] },
  { role: 'clueless corporate manager', gender: 'm', outfit: ['blazer', 'shirt'], accessory: ['beard', 'lanyard', 'glasses'], hair: ['bald', 'short'] },
  { role: 'over-confident senior engineer', gender: 'm', outfit: ['shirt', 'tshirt'], accessory: ['beard', 'glasses'], hair: ['short', 'curly'] },
  { role: 'desi mom / relative who compares with Sharma ji ka beta', gender: 'f', outfit: ['kurta'], accessory: ['bindi'], hair: ['bun', 'long'] },
  { role: 'chill hostel roommate', gender: 'm', outfit: ['tshirt', 'hoodie'], accessory: ['headphones', 'none'], hair: ['curly', 'spiky'] },
  { role: 'confident career mentor', gender: 'f', outfit: ['blazer', 'shirt', 'kurta'], accessory: ['none', 'glasses', 'lanyard'], hair: ['long', 'ponytail', 'bun'] },
  { role: 'friendly tech mentor', gender: 'm', outfit: ['shirt', 'hoodie', 'blazer'], accessory: ['glasses', 'beard', 'none'], hair: ['short', 'curly'] },
];

const NAMES: Record<Gender, string[]> = {
  m: ['Rohan', 'Aarav', 'Kabir', 'Vikram', 'Arjun', 'Sahil', 'Ishaan', 'Dev', 'Karan', 'Yash', 'Neel', 'Pranav', 'Raghav', 'Bunty'],
  f: ['Priya', 'Ananya', 'Sneha', 'Meera', 'Riya', 'Tanvi', 'Kavya', 'Isha', 'Pooja', 'Nisha', 'Aditi', 'Zoya'],
};

const SKINS = ['#F1C27D', '#E0AC69', '#D19A6A', '#C68642', '#B07448', '#A86B3C', '#8D5524', '#7A4A23'];
const HAIRS = ['#111111', '#1B1B1B', '#2B1B12', '#3A2414', '#4A2E1A', '#1A1110'];
const SHIRTS = ['#2563EB', '#DB2777', '#16A34A', '#F59E0B', '#7C3AED', '#DC2626', '#0891B2', '#334155', '#EA580C', '#0D9488', '#4F46E5', '#BE185D'];

/**
 * INDIAN voices only (no US/UK accents).
 *  - Hinglish/Hindi content -> hi-IN voices reading Devanagari-Hinglish = natural desi accent
 *  - English content (or "corporate" personas) -> en-IN voices = Indian-English accent
 * Pitch/rate variants keep two characters on the same base voice distinguishable.
 */
type VoiceOpt = { voice: string; rate: string; pitch: string };
const HINGLISH_VOICES: Record<Gender, VoiceOpt[]> = {
  m: [
    { voice: 'hi-IN-MadhurNeural', rate: '+12%', pitch: '+0Hz' },
    { voice: 'hi-IN-MadhurNeural', rate: '+8%', pitch: '-9Hz' },
    { voice: 'hi-IN-MadhurNeural', rate: '+16%', pitch: '+7Hz' },
  ],
  f: [
    { voice: 'hi-IN-SwaraNeural', rate: '+10%', pitch: '+0Hz' },
    { voice: 'hi-IN-SwaraNeural', rate: '+6%', pitch: '-6Hz' },
    { voice: 'hi-IN-SwaraNeural', rate: '+14%', pitch: '+6Hz' },
  ],
};
const ENGLISH_VOICES: Record<Gender, VoiceOpt[]> = {
  m: [
    { voice: 'en-IN-PrabhatNeural', rate: '+8%', pitch: '+0Hz' },
    { voice: 'en-IN-PrabhatNeural', rate: '+4%', pitch: '-8Hz' },
  ],
  f: [
    { voice: 'en-IN-NeerjaExpressiveNeural', rate: '+6%', pitch: '+0Hz' },
    { voice: 'en-IN-NeerjaNeural', rate: '+5%', pitch: '+3Hz' },
  ],
};
const CORPORATE_ROLES = /hr|manager|interviewer|recruiter|corporate|boss|ceo/i;

function contentLanguage(): 'hinglish' | 'hindi' | 'english' {
  const l = (process.env.CONTENT_LANGUAGE || 'hinglish').toLowerCase();
  return l === 'english' ? 'english' : l === 'hindi' ? 'hindi' : 'hinglish';
}

function voicePool(gender: Gender, role: string): VoiceOpt[] {
  if (contentLanguage() === 'english') return ENGLISH_VOICES[gender];
  // corporate personas sound naturally "Indian-English" when the line is English-heavy
  if (CORPORATE_ROLES.test(role) && contentLanguage() === 'hinglish') return [...ENGLISH_VOICES[gender], ...HINGLISH_VOICES[gender]];
  return HINGLISH_VOICES[gender];
}

/** Narrator voices for voice-only reels. */
export function narratorVoices(): (VoiceOpt & { gender: Gender })[] {
  if (contentLanguage() === 'english') {
    return [
      { ...ENGLISH_VOICES.m[0], gender: 'm' },
      { ...ENGLISH_VOICES.f[0], gender: 'f' },
    ];
  }
  return [
    { voice: 'hi-IN-MadhurNeural', rate: '+10%', pitch: '+0Hz', gender: 'm' },
    { voice: 'hi-IN-SwaraNeural', rate: '+8%', pitch: '+0Hz', gender: 'f' },
  ];
}
export const NARRATOR_VOICES = narratorVoices();

export function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length) % arr.length];
}

function elevenVoiceFor(gender: Gender, index: number): string | undefined {
  // Comma-separated ElevenLabs voice ids per gender, e.g. ELEVENLABS_MALE_VOICES=id1,id2
  const raw = gender === 'm' ? process.env.ELEVENLABS_MALE_VOICES : process.env.ELEVENLABS_FEMALE_VOICES;
  const ids = (raw || '').split(',').map((s) => s.trim()).filter(Boolean);
  return ids.length ? ids[index % ids.length] : undefined;
}

/**
 * Build a cast of `count` distinct characters. `roleHints` lets the script
 * writer request specific personas (e.g. "HR", "mom", "mentor").
 */
export function buildCast(count: number, seed: number, roleHints: string[] = []): CastMember[] {
  const rnd = makeRng(seed);
  const usedNames = new Set<string>();
  const usedVoices = new Set<string>();
  const usedShirts = new Set<string>();
  const cast: CastMember[] = [];

  for (let i = 0; i < count; i++) {
    const hint = (roleHints[i] || '').toLowerCase();
    let persona =
      PERSONAS.find((p) => hint && hint.split(/\W+/).some((w) => w.length > 2 && p.role.includes(w))) ||
      pick(PERSONAS, rnd);
    if (cast.length && cast.every((c) => c.gender === persona.gender) && rnd() < 0.6 && !hint) {
      persona = pick(PERSONAS.filter((p) => p.gender !== persona.gender), rnd);
    }
    const gender = persona.gender;
    let name = pick(NAMES[gender], rnd);
    while (usedNames.has(name)) name = pick(NAMES[gender], rnd);
    usedNames.add(name);

    const role = roleHints[i] || persona.role;
    const pool = voicePool(gender, role);
    const voiceOptions = pool.filter((v) => !usedVoices.has(`${v.voice}${v.pitch}`));
    const v = voiceOptions.length ? voiceOptions[0] : pick(pool, rnd);
    usedVoices.add(`${v.voice}${v.pitch}`);

    let shirt = pick(SHIRTS, rnd);
    while (usedShirts.has(shirt)) shirt = pick(SHIRTS, rnd);
    usedShirts.add(shirt);

    cast.push({
      id: `c${i + 1}`,
      name,
      gender,
      role,
      skin: pick(SKINS, rnd),
      hair: pick(HAIRS, rnd),
      hairStyle: pick(persona.hair, rnd),
      shirt,
      shirtStyle: pick(persona.outfit, rnd),
      accessory: pick(persona.accessory, rnd),
      facialHair: gender === 'm' ? pick(['stubble', 'stubble', 'moustache', 'none', 'beard'] as const, rnd) : 'none',
      earrings: gender === 'f',
      voice: v.voice,
      rate: v.rate,
      pitch: v.pitch,
      elevenVoiceId: elevenVoiceFor(gender, i),
    });
  }
  return cast;
}
