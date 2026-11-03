import { NextRequest, NextResponse } from 'next/server';
import { listConnectedAccounts } from '@/lib/zernio';
import { isAuthenticated } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const accounts = await listConnectedAccounts();
    const mapped = (accounts || []).map((acc: any) => ({
      _id: acc.id || acc._id,
      platform: acc.platform,
      handle: acc.username || acc.name || acc.platform,
      status: 'connected',
    }));

    return NextResponse.json({ accounts: mapped });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, accounts: [] }, { status: 500 });
  }
}

