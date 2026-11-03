import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILlmCall extends Document {
  runId?: string;
  alias: string;
  prompt: string;
  response?: string;
  tokensIn?: number;
  tokensOut?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  latencyMs?: number;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}

const LlmCallSchema = new Schema<ILlmCall>(
  {
    runId: { type: String },
    alias: { type: String, required: true },
    prompt: { type: String, required: true },
    response: { type: String },
    tokensIn: { type: Number },
    tokensOut: { type: Number },
    totalTokens: { type: Number },
    estimatedCostUsd: { type: Number },
    latencyMs: { type: Number },
    success: { type: Boolean, default: true },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

export const LlmCall: Model<ILlmCall> =
  mongoose.models.LlmCall || mongoose.model<ILlmCall>('LlmCall', LlmCallSchema);
export default LlmCall;

