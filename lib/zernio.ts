import { Zernio } from '@zernio/node';
import connectToDatabase from './mongodb';
import Profile from '../models/Profile';

const apiKey = process.env.ZERNIO_API_KEY || '';

if (!apiKey) {
  console.warn('⚠️ Warning: ZERNIO_API_KEY is not defined in environment variables.');
}

export const zernio = new Zernio({ apiKey });

/**
 * Retrieves existing Zernio profile ID from .env, MongoDB, or lists profiles from Zernio
 */
export async function getOrCreateProfileId(): Promise<string> {
  // 1. Direct environment variable override
  if (process.env.ZERNIO_PROFILE_ID) {
    return process.env.ZERNIO_PROFILE_ID;
  }

  // 2. Check MongoDB Profile record
  try {
    await connectToDatabase();
    const existing = await Profile.findOne();
    if (existing && existing.profileId) {
      return existing.profileId;
    }
  } catch (dbErr) {
    console.warn('[MongoDB] Profile lookup skipped or DB not connected yet.');
  }

  // 3. Check existing profiles in Zernio API
  try {
    const { data: profileList } = await zernio.profiles.listProfiles();
    const defaultProfile = (profileList as any)?.profiles?.[0];
    if (defaultProfile?._id || defaultProfile?.id) {
      const pid = defaultProfile._id || defaultProfile.id;
      try {
        await Profile.create({ profileId: pid, name: defaultProfile.name || 'Default' });
      } catch {}
      return pid;
    }
  } catch (zErr: any) {
    console.warn('[Zernio] Could not list existing profiles:', zErr.message);
  }

  // 4. Create new profile via Zernio API if none found
  const { data } = await zernio.profiles.createProfile({
    body: {
      name: process.env.ZERNIO_PROFILE_NAME || 'Social Engine Admin',
    },
  });

  const profileId = (data as any)?.profile?._id || (data as any)?.profile?.id || (data as any)?.id;
  if (!profileId) {
    throw new Error('Failed to create or retrieve Zernio profile ID from API');
  }

  try {
    await Profile.create({
      profileId,
      name: process.env.ZERNIO_PROFILE_NAME || 'Social Engine Admin',
    });
  } catch {}

  return profileId;
}

/**
 * Generates OAuth Connect URL or instructions for a given platform
 */
export async function getOAuthConnectUrl(platform: string, redirectUrl?: string): Promise<any> {
  const profileId = await getOrCreateProfileId();

  const { data } = await zernio.connect.getConnectUrl({
    path: {
      platform: platform as any,
    },
    query: {
      profileId,
      redirect_url: redirectUrl || process.env.NEXTAUTH_URL || 'http://localhost:3000/',
    },
  });

  if (!data) {
    throw new Error(`Failed to generate authorization URL for platform: ${platform}`);
  }

  return data;
}

/**
 * Lists all connected accounts for the profile
 */
export async function listConnectedAccounts(): Promise<any[]> {
  try {
    const profileId = await getOrCreateProfileId();
    const { data } = await zernio.accounts.listAccounts({
      query: { profileId },
    });

    return (data as any)?.accounts || [];
  } catch (err: any) {
    console.warn('[Zernio] Could not fetch connected accounts:', err.message);
    return [];
  }
}

/**
 * Disconnects an account
 */
export async function disconnectAccount(accountId: string): Promise<void> {
  await zernio.accounts.deleteAccount({
    path: { accountId },
  });
}

/**
 * Publishes a post across selected platforms using Zernio
 */
export interface ZernioPublishOptions {
  content: string;
  platforms?: Array<{ platform: string; accountId: string }>;
  mediaUrls?: string[];
  publishNow?: boolean;
}

export async function publishToZernio(options: ZernioPublishOptions): Promise<any> {
  const profileId = await getOrCreateProfileId();

  // If platforms not specified, dispatch to all connected accounts
  let targetPlatforms = options.platforms;
  if (!targetPlatforms || targetPlatforms.length === 0) {
    const connectedAccounts = await listConnectedAccounts();
    if (connectedAccounts.length === 0) {
      throw new Error('No connected social accounts found in Zernio to publish to');
    }

    targetPlatforms = connectedAccounts.map((acc: any) => ({
      platform: acc.platform,
      accountId: acc._id || acc.id,
    }));
  }

  const mediaItems = options.mediaUrls?.map((url) => ({
    type: 'image' as const,
    url,
  }));

  const response = await zernio.posts.createPost({
    body: {
      content: options.content,
      platforms: targetPlatforms as any,
      publishNow: options.publishNow ?? true,
      mediaItems: mediaItems && mediaItems.length > 0 ? (mediaItems as any) : undefined,
    },
  });

  return response.data;
}

export default zernio;
