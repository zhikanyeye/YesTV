import { Redis } from '@upstash/redis';

/**
 * Redis REST 配置来源。
 *
 * Vercel 的 Upstash 集成会自动注入 KV_REST_API_URL / KV_REST_API_TOKEN；
 * 若项目里另外手工配置了 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN，
 * 两组变量可能指向不同的数据库，或其中一组已失效。
 *
 * 这里的策略：
 * 1. 优先采用 KV_REST_API_*（Vercel 自动注入，最可信）。
 * 2. 其次采用 UPSTASH_REDIS_REST_*。
 * 3. URL 与 Token 必须来自同一组变量，避免跨库错配。
 */

interface RedisCredentials {
  url: string;
  token: string;
  source: 'KV' | 'UPSTASH';
}

function resolveCredentials(): RedisCredentials | null {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) {
    return { url: kvUrl, token: kvToken, source: 'KV' };
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) {
    return { url: upstashUrl, token: upstashToken, source: 'UPSTASH' };
  }

  return null;
}

const credentials = resolveCredentials();

export const isDbAvailable = Boolean(credentials);

/** 当前使用的配置来源，用于诊断，不包含任何密钥。 */
export const dbConfigSource = credentials?.source ?? null;

export const db = credentials
  ? new Redis({
      url: credentials.url,
      token: credentials.token,
    })
  : null;
