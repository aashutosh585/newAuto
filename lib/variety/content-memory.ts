import ContentMemoryModel, { IContentMemory } from '../../models/ContentMemory';
import mongoose from 'mongoose';

export interface MemoryCheckCandidate {
  topic: string;
  hookText: string;
  uniqueAngle?: string;
  formatType: string;
  archetype?: string;
  visualStyle?: string;
}

export interface SimilarityResult {
  isDuplicate: boolean;
  rejectionReason?: string;
  topicSimilarity: number;
  hookSimilarity: number;
  isFormatRepetition: boolean;
  isDistinctAngle: boolean;
  recommendations: string[];
}

export interface MemoryConfig {
  topicSimilarityThreshold: number; // default 0.75
  hookSimilarityThreshold: number; // default 0.70
  maxConsecutiveFormatRepetition: number; // default 1
}

const DEFAULT_CONFIG: MemoryConfig = {
  topicSimilarityThreshold: 0.75,
  hookSimilarityThreshold: 0.70,
  maxConsecutiveFormatRepetition: 1,
};

// In-memory fallback cache for fast testing and offline resilience
const inMemoryStore: Partial<IContentMemory>[] = [];

/**
 * Tokenize and normalize text into word sets and bi-grams.
 */
function tokenize(text: string): Set<string> {
  const clean = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
  const words = clean.split(/\s+/).filter((w) => w.length > 2);
  const tokens = new Set<string>(words);

  // Add 2-word n-grams for phrase matching
  for (let i = 0; i < words.length - 1; i++) {
    tokens.add(`${words[i]}_${words[i + 1]}`);
  }

  return tokens;
}

/**
 * Calculate Jaccard similarity between two token sets.
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1.0;
  if (a.size === 0 || b.size === 0) return 0.0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return Number((intersection / union).toFixed(3));
}

/**
 * Normalized Levenshtein distance similarity.
 */
function levenshteinSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1.toLowerCase() : s2.toLowerCase();
  const shorter = s1.length > s2.length ? s2.toLowerCase() : s1.toLowerCase();

  if (longer.length === 0) return 1.0;

  const costs: number[] = [];
  for (let i = 0; i <= shorter.length; i++) costs[i] = i;

  for (let i = 1; i <= longer.length; i++) {
    costs[0] = i;
    let nw = i - 1;
    for (let j = 1; j <= shorter.length; j++) {
      const cj = Math.min(
        1 + Math.min(costs[j], costs[j - 1]),
        longer[i - 1] === shorter[j - 1] ? nw : nw + 1
      );
      nw = costs[j];
      costs[j] = cj;
    }
  }

  const distance = costs[shorter.length];
  return Number((1 - distance / longer.length).toFixed(3));
}

/**
 * Retrieve recent video memories from MongoDB or in-memory store.
 */
export async function getRecentMemories(limit: number = 30): Promise<Partial<IContentMemory>[]> {
  if (mongoose.connection.readyState === 1) {
    try {
      const docs = await ContentMemoryModel.find().sort({ createdAt: -1 }).limit(limit).lean();
      if (docs && docs.length > 0) return docs as any;
    } catch {
      // Fallback to in-memory store
    }
  }
  return inMemoryStore.slice(-limit).reverse();
}

/**
 * Compare candidate video idea against content memory to prevent repetition.
 */
export async function evaluateIdeaSimilarity(
  candidate: MemoryCheckCandidate,
  config: Partial<MemoryConfig> = {}
): Promise<SimilarityResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const history = await getRecentMemories(30);

  if (history.length === 0) {
    return {
      isDuplicate: false,
      topicSimilarity: 0,
      hookSimilarity: 0,
      isFormatRepetition: false,
      isDistinctAngle: true,
      recommendations: ['Content memory is clear. Candidate approved for generation.'],
    };
  }

  const candidateTopicTokens = tokenize(candidate.topic);
  const candidateHookTokens = tokenize(candidate.hookText);
  const recommendations: string[] = [];

  let maxTopicSim = 0;
  let maxHookSim = 0;
  let topicMatchingEntry: Partial<IContentMemory> | null = null;
  let hookMatchingEntry: Partial<IContentMemory> | null = null;

  for (const prev of history) {
    if (!prev.topic || !prev.hookText) continue;

    // 1. Topic Similarity Check
    const prevTopicTokens = tokenize(prev.topic);
    const topicJac = jaccardSimilarity(candidateTopicTokens, prevTopicTokens);
    const topicLev = levenshteinSimilarity(candidate.topic, prev.topic);
    const topicScore = Math.max(topicJac, topicLev);

    if (topicScore > maxTopicSim) {
      maxTopicSim = topicScore;
      topicMatchingEntry = prev;
    }

    // 2. Hook Similarity Check
    const prevHookTokens = tokenize(prev.hookText);
    const hookJac = jaccardSimilarity(candidateHookTokens, prevHookTokens);
    const hookLev = levenshteinSimilarity(candidate.hookText, prev.hookText);
    const hookScore = Math.max(hookJac, hookLev);

    if (hookScore > maxHookSim) {
      maxHookSim = hookScore;
      hookMatchingEntry = prev;
    }
  }

  // 3. Consecutive Format Repetition Check
  const lastMemory = history[0];
  const isFormatRepetition = !!(lastMemory && lastMemory.formatType === candidate.formatType);

  // 4. Legitimate Recurring Topic with Genuinely Distinct Angle Check
  // E.g., if topic similarity is high but the format and angle are fundamentally different
  const hasDistinctFormat = !topicMatchingEntry || topicMatchingEntry.formatType !== candidate.formatType;
  const hasDistinctAngle =
    !!candidate.uniqueAngle &&
    (!topicMatchingEntry ||
      jaccardSimilarity(tokenize(candidate.uniqueAngle), tokenize(topicMatchingEntry.uniqueAngle || '')) < 0.4);

  const isDistinctAngle = hasDistinctFormat && hasDistinctAngle;

  let isDuplicate = false;
  let rejectionReason: string | undefined;

  // Decision Logic:
  if (maxHookSim >= cfg.hookSimilarityThreshold) {
    isDuplicate = true;
    rejectionReason = `Hook similarity too high (${(maxHookSim * 100).toFixed(0)}% match with past hook: "${hookMatchingEntry?.hookText?.slice(0, 50)}...")`;
    recommendations.push('Regenerate hook with a different emotional trigger or contrary opening statement.');
  } else if (maxTopicSim >= cfg.topicSimilarityThreshold) {
    if (isDistinctAngle) {
      isDuplicate = false;
      recommendations.push(
        `Topic is similar to previous run (${(maxTopicSim * 100).toFixed(0)}%), but approved because angle and format are distinctly different (${candidate.formatType} vs ${topicMatchingEntry?.formatType}).`
      );
    } else {
      isDuplicate = true;
      rejectionReason = `Topic similarity exceeds threshold (${(maxTopicSim * 100).toFixed(0)}% match with: "${topicMatchingEntry?.topic}") without a distinct storytelling angle.`;
      recommendations.push('Select a different content angle, niche facet, or contrasting format.');
    }
  }

  if (isFormatRepetition) {
    recommendations.push(
      `Format "${candidate.formatType}" was used in the previous upload. Consider rotating to an alternative format.`
    );
  }

  return {
    isDuplicate,
    rejectionReason,
    topicSimilarity: maxTopicSim,
    hookSimilarity: maxHookSim,
    isFormatRepetition,
    isDistinctAngle,
    recommendations,
  };
}

/**
 * Record a generated or published video to Content Memory.
 */
export async function recordVideoToMemory(entry: {
  topic: string;
  niche: string;
  targetAudience?: string;
  formatType: string;
  archetype?: string;
  uniqueAngle?: string;
  hookText: string;
  hookType: string;
  narrativeStructure?: string;
  visualStyle?: string;
  tags?: string[];
  viralityScore?: number;
  runId?: string;
}): Promise<void> {
  const memoryData: any = {
    ...entry,
    tags: entry.tags || [],
    fingerprint: Array.from(tokenize(entry.topic)).sort().join('_'),
    status: 'generated',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 1. In-memory append
  inMemoryStore.push(memoryData);

  // 2. MongoDB persist
  if (mongoose.connection.readyState === 1) {
    try {
      await ContentMemoryModel.create(memoryData);
    } catch (err: any) {
      console.warn('[ContentMemory] MongoDB persist notice:', err.message);
    }
  }
}

