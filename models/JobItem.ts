import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IJobItem extends Document {
  runId: string;
  dedupeHash: string;
  title: string;
  company: string;
  location: string;
  applyUrl: string;
  source: string;
  status: 'passed' | 'dropped';
  dropReason?: string;
  isLive: boolean;
  score?: number;
  extractedData?: {
    role?: string;
    batch?: string;
    skills?: string[];
    salary?: string;
    highlights?: string[];
  };
  createdAt: Date;
}

const JobItemSchema = new Schema<IJobItem>(
  {
    runId: { type: String, required: true },
    dedupeHash: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, default: 'India' },
    applyUrl: { type: String, required: true },
    source: { type: String, required: true },
    status: { type: String, enum: ['passed', 'dropped'], default: 'passed' },
    dropReason: { type: String },
    isLive: { type: Boolean, default: true },
    score: { type: Number, default: 0 },
    extractedData: {
      role: { type: String },
      batch: { type: String },
      skills: [{ type: String }],
      salary: { type: String },
      highlights: [{ type: String }],
    },
  },
  { timestamps: true }
);

export const JobItem: Model<IJobItem> = mongoose.models.JobItem || mongoose.model<IJobItem>('JobItem', JobItemSchema);
export default JobItem;

