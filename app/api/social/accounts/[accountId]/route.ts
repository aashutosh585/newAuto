import { NextRequest, NextResponse } from 'next/server';
import { disconnectAccount } from '@/lib/zernio';
import { isAuthenticated } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { accountId: string } }
) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { accountId } = params;
    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    await disconnectAccount(accountId);
    return NextResponse.json({ success: true, message: 'Account disconnected successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to disconnect account' }, { status: 500 });
  }
}

