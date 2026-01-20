/**
 * Unlock Sources API Route
 * Verifies the key to unlock premium video sources
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const VIDEO_SOURCE_KEY = process.env.VIDEO_SOURCE_KEY || '1234';

/**
 * GET - Returns the configured unlock key for client-side verification
 * Note: This is intentional for static deployment scenarios
 */
export async function GET() {
    return NextResponse.json({
        key: VIDEO_SOURCE_KEY,
    });
}

/**
 * POST - Verifies if the provided key matches the configured key
 */
export async function POST(request: NextRequest) {
    try {
        const { key } = await request.json();

        if (!key) {
            return NextResponse.json({ valid: false, message: 'Key is required' }, { status: 400 });
        }

        const valid = key === VIDEO_SOURCE_KEY;
        return NextResponse.json({ valid });
    } catch {
        return NextResponse.json({ valid: false, message: 'Invalid request' }, { status: 400 });
    }
}
