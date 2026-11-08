import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REDIS_TIMEOUT_MS = 5000;

/**
 * Lightweight diagnostics for the email-login dependencies (Redis + Resend).
 * Reports only presence/booleans and error messages, never secret values.
 */
export async function GET() {
  const result: Record<string, unknown> = {
    emailLoginConfigured: Boolean(
      process.env.RESEND_API_KEY && process.env.EMAIL_FROM && db,
    ),
    resendConfigured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    redisConfigured: Boolean(db),
    redisUrlSource: process.env.UPSTASH_REDIS_REST_URL
      ? 'UPSTASH_REDIS_REST_URL'
      : process.env.KV_REST_API_URL
        ? 'KV_REST_API_URL'
        : null,
    redisTokenSource: process.env.UPSTASH_REDIS_REST_TOKEN
      ? 'UPSTASH_REDIS_REST_TOKEN'
      : process.env.KV_REST_API_TOKEN
        ? 'KV_REST_API_TOKEN'
        : null,
    redisReachable: false,
    redisError: null as string | null,
  };

  if (!db) {
    result.redisError = 'Redis client is not configured (missing env vars)';
    return NextResponse.json(result);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const key = `auth:diag:ping:${Date.now()}`;
    await Promise.race([
      db.set(key, 'ok', { ex: 30 }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Redis ping timed out after ${REDIS_TIMEOUT_MS}ms`)),
          REDIS_TIMEOUT_MS,
        );
      }),
    ]);
    result.redisReachable = true;
  } catch (error) {
    result.redisError = error instanceof Error ? error.message : String(error);
  } finally {
    if (timer) clearTimeout(timer);
  }

  return NextResponse.json(result);
}
