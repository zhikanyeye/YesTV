import { NextRequest, NextResponse } from 'next/server';
import { db, isDbAvailable } from '@/lib/db';
import { getRequestAuthContext } from '@/lib/auth/request-auth';
import { isUserBanned } from '@/lib/user-management';

const MAX_FAVORITES = 100;

function storageUnavailableResponse() {
  return NextResponse.json({ error: 'Favorites sync is unavailable' }, { status: 503 });
}

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

  if (!isDbAvailable || !db) {
    return storageUnavailableResponse();
  }

  if (await isUserBanned(userId)) {
    return NextResponse.json({ error: 'Account is banned' }, { status: 403 });
  }

  try {
    const favorites = await db.get(`favorites:${userId}`);
    return NextResponse.json(favorites || []);
  } catch (error) {
    console.error('Failed to fetch favorites:', error);
    return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await resolveTargetUserId(req);

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDbAvailable || !db) {
    return storageUnavailableResponse();
  }

  if (await isUserBanned(userId)) {
    return NextResponse.json({ error: 'Account is banned' }, { status: 403 });
  }

  try {
    const favorites = await req.json();
    if (!Array.isArray(favorites)) {
      return NextResponse.json({ error: 'Favorites payload must be an array' }, { status: 400 });
    }

    if (favorites.length > MAX_FAVORITES) {
      return NextResponse.json({ error: `Favorites payload exceeds ${MAX_FAVORITES} items` }, { status: 400 });
    }

    await db.set(`favorites:${userId}`, favorites);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update favorites:', error);
    return NextResponse.json({ error: 'Failed to update favorites' }, { status: 500 });
  }
}

