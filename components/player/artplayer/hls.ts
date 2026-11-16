/**
 * HLS 集成：为 ArtPlayer 的 m3u8 类型提供自定义 hls.js 实例，
 * 支持去广告 loader、清晰度切换、错误恢复与致命错误上报。
 */

import Hls from 'hls.js';
import type Artplayer from 'artplayer';
import { AdFilterLoader } from '@/lib/utils/hls-ad-filter-loader';

export interface HlsSetupContext {
  /** 当前是否开启去广告 */
  isAdBlockEnabled: () => boolean;
  /** 获取播放器实例（延迟读取，实例在构造后才可用），用于注册清晰度选择器与提示 */
  getArt: () => Artplayer | null;
  /** 致命错误回调（交由上层决定换源/代理） */
  onError: (error: string) => void;
  /** 记录最新 hls 实例，便于生命周期结束时销毁 */
  setHls: (hls: Hls | null) => void;
}

/**
 * 创建 HLS 加载函数，供 ArtPlayer customType 使用。
 * 返回的 loader 会在每次加载新源时销毁旧实例并重建。
 */
export function createHlsLoader(ctx: HlsSetupContext) {
  return (video: HTMLVideoElement, url: string) => {
    ctx.setHls(null);

    if (!Hls.isSupported()) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
      } else {
        ctx.onError('当前浏览器不支持 HLS 播放，请更换浏览器');
      }
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      maxBufferLength: 60,
      maxMaxBufferLength: 120,
      maxBufferSize: 60 * 1000 * 1000,
      maxBufferHole: 0.5,
      startFragPrefetch: true,
      abrEwmaDefaultEstimate: 500000,
      abrBandWidthFactor: 0.8,
      fragLoadingMaxRetry: 3,
      fragLoadingRetryDelay: 500,
      fragLoadingMaxRetryTimeout: 8000,
      manifestLoadingMaxRetry: 2,
      manifestLoadingRetryDelay: 500,
      manifestLoadingMaxRetryTimeout: 4000,
      levelLoadingMaxRetry: 2,
      levelLoadingRetryDelay: 500,
      levelLoadingMaxRetryTimeout: 4000,
      fragLoadingTimeOut: 15000,
      manifestLoadingTimeOut: 8000,
      levelLoadingTimeOut: 8000,
      backBufferLength: 30,
      ...(ctx.isAdBlockEnabled() && {
        loader: AdFilterLoader as unknown as typeof Hls.DefaultConfig.loader,
      }),
    });

    ctx.setHls(hls);
    hls.loadSource(url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      const art = ctx.getArt();
      if (art) registerQualitySelector(art, hls);
    });

    let networkErrorRetries = 0;
    let mediaErrorRetries = 0;
    const MAX_RETRIES = 2;

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;

      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR: {
          const status = data.response?.code;
          if (status === 401 || status === 403 || status === 451) {
            console.error(`[ArtPlayer] Source refused access (HTTP ${status})`);
            ctx.onError('源站拒绝访问（地区限制或防盗链），自动切换代理重试');
            ctx.setHls(null);
            break;
          }
          networkErrorRetries++;
          console.error(
            `[ArtPlayer] Network error (${networkErrorRetries}/${MAX_RETRIES}), trying to recover...`,
            data
          );
          if (networkErrorRetries <= MAX_RETRIES) {
            hls.startLoad();
          } else {
            console.error('[ArtPlayer] Too many network errors, giving up');
            ctx.onError('网络错误：无法加载视频流');
            ctx.setHls(null);
          }
          break;
        }
        case Hls.ErrorTypes.MEDIA_ERROR:
          mediaErrorRetries++;
          console.error(
            `[ArtPlayer] Media error (${mediaErrorRetries}/${MAX_RETRIES}), trying to recover...`,
            data
          );
          if (mediaErrorRetries <= MAX_RETRIES) {
            hls.recoverMediaError();
          } else {
            console.error('[ArtPlayer] Too many media errors, giving up');
            ctx.onError('媒体错误：视频格式不支持或已损坏');
            ctx.setHls(null);
          }
          break;
        default:
          console.error('[ArtPlayer] Fatal error, cannot recover:', data);
          ctx.onError(`致命错误：${data.details || '未知错误'}`);
          ctx.setHls(null);
          break;
      }
    });
  };
}

/** 多码率时生成清晰度切换菜单 */
function registerQualitySelector(art: Artplayer, hls: Hls) {
  const levels = hls.levels;
  if (!levels || levels.length === 0) return;

  const hasHEVC = levels.some(
    (level) =>
      level.videoCodec?.toLowerCase().includes('hev') ||
      level.videoCodec?.toLowerCase().includes('h265')
  );
  if (hasHEVC) {
    console.warn('[ArtPlayer] HEVC/H.265 codec detected - may not play in all browsers');
    art.notice.show = '检测到 HEVC 编码，部分浏览器可能不支持';
  }

  if (levels.length <= 1) return;

  const qualityList = levels.map((lvl, idx) => ({
    default: idx === hls.currentLevel,
    html: lvl.name || (lvl.height ? `${lvl.height}P` : `级别 ${idx + 1}`),
    level: idx,
  }));
  qualityList.unshift({ default: hls.autoLevelEnabled, html: '自动', level: -1 });

  try {
    if (art.controls.quality) art.controls.remove('quality');
    art.controls.add({
      name: 'quality',
      index: 20,
      position: 'right',
      html: qualityList.find((q) => q.default)?.html || '清晰度',
      selector: qualityList.map((q) => ({
        default: q.default,
        html: q.html,
        level: q.level,
      })),
      onSelect: function (item) {
        const targetLevel = (item as unknown as { level: number }).level;
        hls.currentLevel = targetLevel;
        art.notice.show = `已切换至：${item.html}`;
        return item.html;
      },
    });
  } catch (e) {
    console.warn('[ArtPlayer] Failed to register quality selector:', e);
  }
}
