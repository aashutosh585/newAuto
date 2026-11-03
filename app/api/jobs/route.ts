import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import JobItem from '@/models/JobItem';
import { isAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const items = await JobItem.find().sort({ createdAt: -1 }).limit(50);
    return NextResponse.json({ items });
  } catch (err: any) {
    console.warn('[Jobs API] DB query skipped:', err.message);
    return NextResponse.json({ items: [], warning: err.message });
  }
}

