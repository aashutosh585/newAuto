import { VideoFormatId } from '../variety/format-engine';

export type ReelArchetype =
  | 'funny_roast'        // College friend roast / hilarious relatable fresher POV
  | 'dino_mascot'        // Cute cartoon Dino from DinoMate delivering spicy jokes & job drops
  | 'solo_explainer'     // Single person/mentor breaking down the job, roadmap & tips directly
  | 'breaking_drop'       // High-energy urgent hiring alert
  | 'salary_reality'      // Deep dive into real fresher salaries & interview reality
  | 'zero_exp_roadmap';   // Step-by-step roadmap for BCA / MCA / non-CS grads

export interface VideoScene {
  name: 'hook' | 'eligibility' | 'skills' | 'salary' | 'cta';
  title: string;
  subtitle?: string;
  narrationText: string;
  audioPath?: string;
  durationSec: number;
}

export interface VideoReelPlan {
  archetype: ReelArchetype;
  formatType?: VideoFormatId;
  role: string;
  batch: string;
  degrees: string;
  skills: string[];
  salary: string;
  companies: string;
  // Specific visual texts
  hookHeadline: string;
  hookSubtext: string;
  roastDialogue?: string; // For funny_roast or comedic dialogue
  // Scene-by-scene voiceover narration texts
  narrationHook: string;
  narrationEligibility: string;
  narrationSkills: string;
  narrationSalary: string;
  narrationCta: string;
  // Social metadata
  caption: string;
  suggestedVoice?: 'hi-IN-MadhurNeural' | string;
  // Variety & Quality metadata
  trendTopic?: string;
  qualityScore?: number;
  structuredBrief?: any;
}
