import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPostMetric extends Document {
  postId: string;         // references Post._id
  platform: string;
  externalPostId?: string;
  likes?: number;
  reach?: number;
  impressions?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  fetchedAt: Date;
  createdAt: Date;
}

const PostMetricSchema = new Schema<IPostMetric>(
  {
    postId: { type: String, required: true, index: true },
    platform: { type: String, required: true },
    externalPostId: { type: String },
    likes: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    fetchedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

export const PostMetric: Model<IPostMetric> =
  mongoose.models.PostMetric ||
  mongoose.model<IPostMetric>('PostMetric', PostMetricSchema);
export default PostMetric;

