import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPost extends Document {
  runId: string;
  platform: string; // 'telegram' | 'instagram' | 'youtube' | 'x'
  externalPostId?: string;
  postUrl?: string;
  caption: string;
  status: 'published' | 'failed';
  errorMessage?: string;
  publishedAt?: Date;
  createdAt: Date;
}

const PostSchema = new Schema<IPost>(
  {
    runId: { type: String, required: true },
    platform: { type: String, required: true },
    externalPostId: { type: String },
    postUrl: { type: String },
    caption: { type: String, required: true },
    status: { type: String, enum: ['published', 'failed'], default: 'published' },
    errorMessage: { type: String },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Post: Model<IPost> = mongoose.models.Post || mongoose.model<IPost>('Post', PostSchema);
export default Post;

