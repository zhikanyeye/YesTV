import { NextRequest, NextResponse } from 'next/server';
import {
  EMAIL_TOKEN_TTL_SECONDS,
  createEmailToken,
  isEmailLoginConfigured,
  isValidEmail,
  normalizeEmail,
  sha256Hex,
} from '@/lib/auth/email-token';
import { sendMagicLinkEmail } from '@/lib/auth/mailer';
import { withinRateLimit } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_LIMIT = 3;
const IP_LIMIT = 10;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

function getBaseUrl(request: NextRequest): string {
  const configured = process.env.NEXTAUTH_URL;
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!isEmailLoginConfigured()) {
    return NextResponse.json({ error: '邮箱登录尚未配置' }, { status: 503 });
  }

  let rawEmail = '';
  try {
    const body = (await request.json()) as { email?: unknown };
    rawEmail = typeof body.email === 'string' ? body.email : '';
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: '请输入有效的邮箱地址' }, { status: 400 });
  }

  const windowSeconds = EMAIL_TOKEN_TTL_SECONDS;
  const ipAllowed = await withinRateLimit(
    `auth:email:rl:ip:${getClientIp(request)}`,
    IP_LIMIT,
    windowSeconds,
  );
  const emailAllowed = await withinRateLimit(
    `auth:email:rl:addr:${sha256Hex(email)}`,
    EMAIL_LIMIT,
    windowSeconds,
  );
  if (!ipAllowed || !emailAllowed) {
    return NextResponse.json({ error: '请求过于频繁，请 10 分钟后再试' }, { status: 429 });
  }

  try {
    const token = await createEmailToken(email);
    const link = `${getBaseUrl(request)}/auth/email?${new URLSearchParams({ email, token }).toString()}`;
    await sendMagicLinkEmail(email, link);
  } catch (error) {
    console.error('Failed to send magic link:', error);
    return NextResponse.json({ error: '发送失败，请稍后重试' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
