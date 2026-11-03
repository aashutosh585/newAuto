import { NicheDefinition, StyleConfig } from '@social-engine/core';
import { JobSpyCollector } from './collectors/jobspy.js';
import { ATSCollector } from './collectors/ats.js';
import { DinoMateCollector } from './collectors/dinomate.js';
import { checkJobEligibility } from './filters.js';
import { JobRanker } from './ranker.js';
import { JobWriter } from './writer.js';
import { JobRenderer } from './renderer.js';

export const defaultJobStyle: StyleConfig = {
  palette: {
    primary: '#0F172A',
    secondary: '#1E293B',
    background: '#090D16',
    cardBackground: '#111827',
    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8',
    accent: '#3B82F6',
  },
  font: {
    family: 'Inter, system-ui, sans-serif',
    headingWeight: '900',
    bodyWeight: '500',
  },
  layout: {
    padding: 80,
    borderRadius: 32,
    badgeStyle: 'pill',
  },
  hookFormula: 'Top Fresh Graduate Tech Openings Today',
  pacing: {
    videoDurationSeconds: 25,
    sceneDurationSeconds: 4,
  },
  brand: {
    name: 'FRESHER HIRING ALERTS',
    tagline: 'Verified direct apply software jobs for 2024, 2025 & 2026 graduates',
    telegramLink: process.env.TELEGRAM_CHANNEL_ID || 't.me/YourJobChannel',
    instagramHandle: '@fresherjobsalert',
  },
};

export const jobsNiche: NicheDefinition = {
  name: 'jobs',
  displayName: 'Fresher Tech Jobs',
  description: 'Automated curation and posting of verified early career and fresher software engineering jobs',
  collectors: [
    new JobSpyCollector(),
    new ATSCollector(),
    new DinoMateCollector(),
  ],
  ranker: new JobRanker(),
  writer: new JobWriter(),
  renderer: new JobRenderer(),
  defaultStyle: defaultJobStyle,
  thresholds: {
    minItemsToPost: 5,
    maxItemsPerCarousel: 8,
  },
  deduplicate: (item) => item.dedupeHash,
  isEligible: checkJobEligibility,
};

export default jobsNiche;
