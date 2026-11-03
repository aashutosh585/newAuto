import { RawItem, checkUrlLiveness } from '@social-engine/core';

const FRESHER_KEYWORDS = [
  'fresher',
  'intern',
  'internship',
  'graduate',
  'entry level',
  'entry-level',
  'junior',
  'trainee',
  'associate',
  'campus',
  '0-1',
  '0-2',
  'new grad',
  '2024',
  '2025',
  '2026',
];

const SENIOR_EXCLUSIONS = [
  'senior',
  'sr.',
  'lead',
  'staff',
  'principal',
  'manager',
  'director',
  'head of',
  'architect',
  '5+ years',
  '6+ years',
  '7+ years',
  '8+ years',
  '10+ years',
];

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

export function checkJobEligibility(item: RawItem): EligibilityResult {
  const data = item.rawData || {};
  const title = String(data.title || '').toLowerCase();
  const description = String(data.description || '').toLowerCase();
  const combined = `${title} ${description.slice(0, 500)}`;

  // 1. Check age (< 48 hours)
  if (item.publishedAt) {
    const ageMs = Date.now() - new Date(item.publishedAt).getTime();
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;
    if (ageMs > fortyEightHoursMs) {
      return { eligible: false, reason: '>48h old' };
    }
  }

  // 2. Reject Senior exclusions
  for (const exclusion of SENIOR_EXCLUSIONS) {
    if (title.includes(exclusion)) {
      return { eligible: false, reason: `Excluded: contains "${exclusion}" in title` };
    }
  }

  // 3. Must match Fresher / Early Career criteria
  const isFresherMatch = FRESHER_KEYWORDS.some((kw) => combined.includes(kw));
  if (!isFresherMatch) {
    return { eligible: false, reason: 'Not fresher / early career role' };
  }

  // 4. Must have valid apply URL
  if (!item.externalUrl || !item.externalUrl.startsWith('http')) {
    return { eligible: false, reason: 'Missing or invalid apply URL' };
  }

  return { eligible: true };
}

export async function verifyLiveness(items: RawItem[], concurrency = 4): Promise<Map<string, boolean>> {
  const livenessMap = new Map<string, boolean>();

  // Process in small chunks to avoid flooding
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (item) => {
        try {
          const res = await checkUrlLiveness(item.externalUrl, 6000);
          livenessMap.set(item.dedupeHash, res.isLive);
        } catch {
          livenessMap.set(item.dedupeHash, false);
        }
      })
    );
  }

  return livenessMap;
}

