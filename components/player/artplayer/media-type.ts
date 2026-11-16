/**
 * 媒体类型判定：按播放地址（优先原始地址）推断走 hls.js 还是浏览器原生播放。
 */

export type MediaType = 'm3u8' | 'mp4' | 'auto';

/**
 * 从 URL 推断媒体类型。
 * 代理地址没有扩展名，因此调用方应优先传入未经代理的原始地址。
 */
export function detectMediaType(url: string): MediaType {
  const path = url.split(/[?#]/)[0].toLowerCase();
  if (path.includes('.m3u8')) return 'm3u8';
  if (path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.mkv')) return 'mp4';
  return 'auto';
}

/**
 * 结合原始地址与当前播放地址解析最终媒体类型：
 * 原始地址能识别时以它为准，否则回退到当前播放地址。
 */
export function resolveMediaType(sourceUrl: string | undefined, src: string): MediaType {
  const original = detectMediaType(sourceUrl || src);
  return original === 'auto' ? detectMediaType(src) : original;
}
