export type LLMAlias = 'fast' | 'writer' | 'writer-local';

export interface RunContext {
  runId: string;
  slot: string;
  niche: string;
  triggerSource: string;
  logger: StageLogger;
}

export interface StageLogger {
  info(message: string, metadata?: Record<string, unknown>): Promise<void>;
  warn(message: string, metadata?: Record<string, unknown>): Promise<void>;
  error(message: string, metadata?: Record<string, unknown>): Promise<void>;
  debug(message: string, metadata?: Record<string, unknown>): Promise<void>;
}

export interface RawItem {
  source: string;
  externalId?: string;
  externalUrl: string;
  publishedAt?: Date;
  dedupeHash: string;
  rawData: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ExtractedItemData {
  title: string;
  company?: string;
  role?: string;
  batch?: string;
  skills?: string[];
  location?: string;
  salary?: string;
  applyUrl: string;
  deadline?: string;
  highlights?: string[];
  [key: string]: unknown;
}

export interface RankedItemOutput {
  itemId: string;
  score: number; // 0 - 100
  reasoning: string;
  extractedData: ExtractedItemData;
  isSelected: boolean;
}

export interface StyleConfig {
  palette: {
    primary: string;
    secondary: string;
    background: string;
    cardBackground: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
  };
  font: {
    family: string;
    headingWeight: string;
    bodyWeight: string;
  };
  layout: {
    padding: number;
    borderRadius: number;
    badgeStyle: string;
  };
  hookFormula: string;
  pacing: {
    videoDurationSeconds: number;
    sceneDurationSeconds: number;
  };
  brand: {
    name: string;
    tagline: string;
    logoUrl?: string;
    telegramLink?: string;
    instagramHandle?: string;
  };
}

export interface PostContent {
  headline: string;
  telegramCaption: string;
  instagramCaption: string;
  youtubeTitle: string;
  youtubeDescription: string;
  xPostText: string;
  tags: string[];
}

export interface MediaAsset {
  type: 'CAROUSEL_IMAGE' | 'VIDEO' | 'AUDIO' | 'THUMBNAIL';
  path: string;
  mimeType: string;
  sequenceOrder: number;
  metadata?: Record<string, unknown>;
}

export interface CollectorInterface {
  name: string;
  collect(context: RunContext): Promise<RawItem[]>;
}

export interface RankerInterface {
  rank(items: RawItem[], context: RunContext): Promise<RankedItemOutput[]>;
}

export interface WriterInterface {
  writeCaptions(rankedItems: RankedItemOutput[], style: StyleConfig, context: RunContext): Promise<PostContent>;
}

export interface RendererInterface {
  renderCarousel(
    rankedItems: RankedItemOutput[],
    postContent: PostContent,
    style: StyleConfig,
    context: RunContext
  ): Promise<MediaAsset[]>;
  renderVideo?(
    rankedItems: RankedItemOutput[],
    postContent: PostContent,
    style: StyleConfig,
    context: RunContext
  ): Promise<MediaAsset | null>;
}

export interface NicheDefinition {
  name: string;
  displayName: string;
  description: string;
  collectors: CollectorInterface[];
  ranker: RankerInterface;
  writer: WriterInterface;
  renderer: RendererInterface;
  defaultStyle: StyleConfig;
  thresholds: {
    minItemsToPost: number;
    maxItemsPerCarousel: number;
  };
  deduplicate: (item: RawItem) => string;
  isEligible?: (item: RawItem) => { eligible: boolean; reason?: string };
}
