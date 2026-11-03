import { NicheDefinition } from '@social-engine/core';
import { jobsNiche } from '@social-engine/niche-jobs';
import { scholarshipNiche } from '@social-engine/niche-scholarships';

const niches = new Map<string, NicheDefinition>();

// Register available niches
niches.set(jobsNiche.name, jobsNiche);
niches.set(scholarshipNiche.name, scholarshipNiche);

export function getNiche(name: string): NicheDefinition {
  const niche = niches.get(name.toLowerCase());
  if (!niche) {
    throw new Error(`Unknown niche: "${name}". Available niches: ${Array.from(niches.keys()).join(', ')}`);
  }
  return niche;
}

export function listAvailableNiches(): string[] {
  return Array.from(niches.keys());
}
