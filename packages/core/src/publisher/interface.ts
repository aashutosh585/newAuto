export type ChannelType = 'telegram' | 'instagram' | 'youtube' | 'x';

export interface PublishMediaItem {
  path: string;
  publicUrl?: string;
  type: 'image' | 'video';
}

export interface PublishPayload {
  runId: string;
  channel: ChannelType;
  caption: string;
  media: PublishMediaItem[];
  title?: string;
  tags?: string[];
}

export interface PublishResult {
  success: boolean;
  channel: ChannelType;
  publisherName: string;
  externalPostId?: string;
  externalPostUrl?: string;
  error?: string;
}

export interface Publisher {
  name: string;
  publish(payload: PublishPayload): Promise<PublishResult>;
}
