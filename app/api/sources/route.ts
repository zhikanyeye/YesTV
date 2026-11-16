import { NextRequest, NextResponse } from 'next/server';
import { db, isDbAvailable } from '@/lib/db';
import { getRequestAuthContext } from '@/lib/auth/request-auth';
import { isUserBanned } from '@/lib/user-management';
import type { VideoSource } from '@/lib/types';

const MAX_SOURCES = 200;

function storageUnavailableResponse() {
  return NextResponse.json({ error: 'Source sync is unavailable' }, { status: 503 });
}

function isValidSource(value: unknown): value is VideoSource {
  if (!value || typeof value !== 'object') return false;
  const source = value as Record<string, unknown>;
  return typeof source.id === 'string' && source.id.length > 0
    && typeof source.name === 'string' && source.name.length > 0
    && typeof source.baseUrl === 'string' && source.baseUrl.length > 0;
}

export async function GET(req: NextRequest) {
  const auth = await getRequestAuthContext(req);
  if (!auth.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDbAvailable || !db) {
    return storageUnavailableResponse();
  }

  if (await isUserBanned(auth.userId)) {
    return NextResponse.json({ error: 'Account is banned' }, { status: 403 });
  }

  try {
    const sources = await db.get(`sources:${auth.userId}`);
    return NextResponse.json({ sources: Array.isArray(sources) ? sources : [] });
  } catch (error) {
    console.error('Failed to fetch sources:', error);
    return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await getRequestAuthContext(req);
  if (!auth.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDbAvailable || !db) {
    return storageUnavailableResponse();
  }

  if (await isUserBanned(auth.userId)) {
    return NextResponse.json({ error: 'Account is banned' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const sources = body?.sources;
    if (!Array.isArray(sources) || !sources.every(isValidSource)) {
      return NextResponse.json({ error: 'Sources payload must be an array of valid sources' }, { status: 400 });
    }

    if (sources.length > MAX_SOURCES) {
      return NextResponse.json({ error: `Sources payload exceeds ${MAX_SOURCES} items` }, { status: 400 });
    }

    await db.set(`sources:${auth.userId}`, sources);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update sources:', error);
    return NextResponse.json({ error: 'Failed to update sources' }, { status: 500 });
  }
}
