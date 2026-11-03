import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStage {
  name: string; // 'collect' | 'rank' | 'write' | 'publish'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  itemsIn?: number;
  itemsOut?: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface IRun extends Document {
  slot: string;
  idempotencyKey: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  triggerSource: string;
  stages: IStage[];
  itemsFound: number;
  itemsPassed: number;
  postsPublished: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StageSchema = new Schema<IStage>(
  {
    name: { type: String, required: true },
    status: { type: String, default: 'pending' },
    itemsIn: { type: Number, default: 0 },
    itemsOut: { type: Number, default: 0 },
    errorMessage: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { _id: false }
);

const RunSchema = new Schema<IRun>(
  {
    slot: { type: String, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
      default: 'pending',
    },
    triggerSource: { type: String, default: 'cron' },
    stages: [StageSchema],
    itemsFound: { type: Number, default: 0 },
    itemsPassed: { type: Number, default: 0 },
    postsPublished: { type: Number, default: 0 },
    errorMessage: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

export const Run: Model<IRun> = mongoose.models.Run || mongoose.model<IRun>('Run', RunSchema);
export default Run;

