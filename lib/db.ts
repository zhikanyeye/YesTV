import { Redis } from '@upstash/redis';

// Vercel Marketplace's Upstash integration may inject KV_REST_API_* instead of
// (or in addition to) UPSTASH_REDIS_REST_*; accept both
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export const isDbAvailable = Boolean(redisUrl && redisToken);

export const db = isDbAvailable
  ? new Redis({
      url: redisUrl!,
      token: redisToken!,
    })
  : null;
