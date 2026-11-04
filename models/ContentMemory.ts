import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IContentMemory extends Document {
  runId?: string;
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
  tags: string[];
  fingerprint: string;
  viralityScore?: number;
  status: 'draft' | 'generated' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

const ContentMemorySchema = new Schema<IContentMemory>(
  {
    runId: { type: String, index: true },
    topic: { type: String, required: true, index: true },
    niche: { type: String, required: true, index: true },
    targetAudience: { type: String },
    formatType: { type: String, required: true, index: true },
    archetype: { type: String, index: true },
    uniqueAngle: { type: String },
    hookText: { type: String, required: true },
    hookType: { type: String, index: true },
    narrativeStructure: { type: String },
    visualStyle: { type: String },
    tags: [{ type: String }],
    fingerprint: { type: String, index: true },
    viralityScore: { type: Number, default: 0.5 },
    status: { type: String, enum: ['draft', 'generated', 'published'], default: 'generated' },
  },
  { timestamps: true }
);

export const ContentMemory: Model<IContentMemory> =
  mongoose.models.ContentMemory || mongoose.model<IContentMemory>('ContentMemory', ContentMemorySchema);

export default ContentMemory;

