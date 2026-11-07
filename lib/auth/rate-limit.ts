import { db } from '@/lib/db';

/**
 * Fixed-window counter. Returns true when the call is within the limit.
 * Fails open when Redis is unavailable so a Redis hiccup does not block login.
 */
export async function withinRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  if (!db) {
    return true;
  }

  try {
    const count = await db.incr(key);
    if (count === 1) {
      await db.expire(key, windowSeconds);
    }
    return count <= limit;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return true;
  }
}
