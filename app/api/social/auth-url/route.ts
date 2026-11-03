import { NextRequest, NextResponse } from 'next/server';
import { getOAuthConnectUrl } from '@/lib/zernio';
import { isAuthenticated } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { platform, redirectUrl } = await req.json();

    if (!platform) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
    }

    const data = await getOAuthConnectUrl(platform, redirectUrl);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to generate connect URL' }, { status: 500 });
  }
}

