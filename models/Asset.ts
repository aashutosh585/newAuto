import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAsset extends Document {
  runId: string;
  type: 'image' | 'video';
  url: string;
  slideIndex?: number;  // for carousel: 0-based slide number
  width?: number;
  height?: number;
  label?: string;       // e.g. "Google - SWE Intern" or "cover_slide"
  generatedAt: Date;
  createdAt: Date;
}

const AssetSchema = new Schema<IAsset>(
  {
    runId: { type: String, required: true, index: true },
    type: { type: String, enum: ['image', 'video'], required: true },
    url: { type: String, required: true },
    slideIndex: { type: Number },
    width: { type: Number },
    height: { type: Number },
    label: { type: String },
    generatedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

export const Asset: Model<IAsset> =
  mongoose.models.Asset || mongoose.model<IAsset>('Asset', AssetSchema);
export default Asset;

