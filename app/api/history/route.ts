import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestAuthContext } from '@/lib/auth/request-auth';
import { isUserBanned } from '@/lib/user-management';


async function resolveTargetUserId(req: NextRequest): Promise<string | null> {
  const auth = await getRequestAuthContext(req);
  if (!auth.userId) return null;

  const { searchParams } = new URL(req.url);
  const requestedUserId = searchParams.get('userId');

  if (auth.isAdmin && requestedUserId) {
    return requestedUserId;
  }

  return auth.userId;
}

export async function GET(req: NextRequest) {
  const userId = await resolveTargetUserId(req);

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (await isUserBanned(userId)) {
    return NextResponse.json({ error: 'Account is banned' }, { status: 403 });
  }

  try {
    const history = await db.get(`history:${userId}`);
    return NextResponse.json(history || []);
  } catch (error) {
    console.error('Failed to fetch history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await resolveTargetUserId(req);

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (await isUserBanned(userId)) {
    return NextResponse.json({ error: 'Account is banned' }, { status: 403 });
  }

  try {
    const history = await req.json();
    await db.set(`history:${userId}`, history);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update history:', error);
    return NextResponse.json({ error: 'Failed to update history' }, { status: 500 });
  }
}

