import { NextResponse } from 'next/server';
import { db, dbConfigSource } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REDIS_TIMEOUT_MS = 5000;

/**
 * Lightweight diagnostics for the email-login dependencies (Redis + Resend).
 * Reports only presence/booleans and error messages, never secret values.
 */
export async function GET() {
  // 使用与 db 相同的来源，保证诊断反映真实使用的配置
  const isKv = dbConfigSource === 'KV';
  const rawUrl =
    (isKv ? process.env.KV_REST_API_URL : process.env.UPSTASH_REDIS_REST_URL) || '';
  const rawToken =
    (isKv ? process.env.KV_REST_API_TOKEN : process.env.UPSTASH_REDIS_REST_TOKEN) ||
    '';

  let urlHost: string | null = null;
  let urlProtocol: string | null = null;
  let urlHasWhitespace = false;
  try {
    urlHasWhitespace = rawUrl !== rawUrl.trim();
    const parsed = new URL(rawUrl.trim());
    urlHost = parsed.host;
    urlProtocol = parsed.protocol;
  } catch {
    urlHost = null;
  }

  const result: Record<string, unknown> = {
    emailLoginConfigured: Boolean(
      process.env.RESEND_API_KEY && process.env.EMAIL_FROM && db,
    ),
    resendConfigured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    redisConfigured: Boolean(db),
    redisConfigSource: dbConfigSource,
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
    // 仅暴露格式特征，不暴露密钥内容
    urlHost,
    urlProtocol,
    urlHasWhitespace,
    urlLength: rawUrl.length,
    tokenLength: rawToken.length,
    tokenPrefix: rawToken.slice(0, 3),
    redisReachable: false,
    redisError: null as string | null,
    rawFetchStatus: null as number | null,
    rawFetchError: null as string | null,
  };

  if (!db) {
    result.redisError = 'Redis client is not configured (missing env vars)';
    return NextResponse.json(result);
  }

  // 直接用 fetch 打 Upstash REST /ping，拿到最底层的错误（DNS/TLS/超时）
  try {
    const pingUrl = `${rawUrl.trim().replace(/\/+$/, '')}/ping`;
    const res = await fetch(pingUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${rawToken.trim()}` },
      signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
    });
    result.rawFetchStatus = res.status;
  } catch (error) {
    const e = error as Error & { cause?: { code?: string } };
    result.rawFetchError = `${e.message}${e.cause?.code ? ` (${e.cause.code})` : ''}`;
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
