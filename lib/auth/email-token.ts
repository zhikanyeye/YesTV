import { createHash, randomBytes } from 'crypto';
import { db } from '@/lib/db';

export const EMAIL_TOKEN_TTL_SECONDS = 600;

const TOKEN_KEY_PREFIX = 'auth:email:token:';
const REDIS_TIMEOUT_MS = 5000;

/**
 * Wraps a Redis operation with a hard timeout so a misconfigured or
 * unreachable Redis never hangs the request until the platform timeout.
 */
async function withRedisTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Redis operation timed out after ${REDIS_TIMEOUT_MS}ms: ${label}`)),
          REDIS_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function isEmailLoginConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && db);
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

/** Stable user id derived from the email; raw address is never part of the id. */
export function emailToUserId(email: string): string {
  return `email:${sha256Hex(normalizeEmail(email)).slice(0, 32)}`;
}

/** Creates a single-use login token and stores only its hash in Redis. */
export async function createEmailToken(email: string): Promise<string> {
  if (!db) {
    throw new Error('Redis is not configured');
  }

  const token = randomBytes(32).toString('hex');
  await withRedisTimeout(
    db.set(`${TOKEN_KEY_PREFIX}${sha256Hex(token)}`, normalizeEmail(email), {
      ex: EMAIL_TOKEN_TTL_SECONDS,
    }),
    'createEmailToken.set',
  );
  return token;
}

/**
 * Atomically consumes a token. Returns true only when the token exists and was
 * issued for the given email; the token is removed either way (GETDEL).
 */
export async function consumeEmailToken(email: string, token: string): Promise<boolean> {
  if (!db || !token) {
    return false;
  }

  const stored = await withRedisTimeout(
    db.getdel<string>(`${TOKEN_KEY_PREFIX}${sha256Hex(token)}`),
    'consumeEmailToken.getdel',
  );
  return typeof stored === 'string' && stored === normalizeEmail(email);
}
