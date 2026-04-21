import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export const isDbAvailable = Boolean(redisUrl && redisToken);

export const db = isDbAvailable
  ? new Redis({
      url: redisUrl!,
      token: redisToken!,
    })
  : null;
