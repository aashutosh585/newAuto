import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IProfile extends Document {
  profileId: string;
  name: string;
  createdAt: Date;
}

const ProfileSchema = new Schema<IProfile>(
  {
    profileId: { type: String, required: true, unique: true },
    name: { type: String, default: 'Default Social Engine Profile' },
  },
  { timestamps: true }
);

export const Profile: Model<IProfile> = mongoose.models.Profile || mongoose.model<IProfile>('Profile', ProfileSchema);
export default Profile;

