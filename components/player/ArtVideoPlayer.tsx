'use client';

import { useEffect, useRef, useCallback } from 'react';
import type Artplayer from 'artplayer';
import Hls from 'hls.js';
import { usePlayerSettings } from './hooks/usePlayerSettings';
import { AdFilterLoader } from '@/lib/utils/hls-ad-filter-loader';

// ArtPlayer 通过 dynamic import 在组件内加载，避免 SSR 问题

interface ArtVideoPlayerProps {
  src: string;
  poster?: string;
  onError?: (error: string) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onResolutionChange?: (resolution: { width: number; height: number } | null) => void;
  initialTime?: number;
  shouldAutoPlay?: boolean;
  totalEpisodes?: number;
  currentEpisodeIndex?: number;
  onNextEpisode?: () => void;
  isReversed?: boolean;
}

export function ArtVideoPlayer({
  src,
  poster,
  onError,
  onTimeUpdate,
  onResolutionChange,
  initialTime = 0,
  shouldAutoPlay = true,
  totalEpisodes = 1,
  currentEpisodeIndex = 0,
  onNextEpisode,
  isReversed = false,
}: ArtVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<Artplayer | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSrcRef = useRef(src);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasSkippedIntroRef = useRef(false);
  const hasTriggeredOutroSkipRef = useRef(false);
  const lastHandledSrcRef = useRef<string>('');

  const {
    autoNextEpisode,
    autoSkipIntro,
    skipIntroSeconds,
    autoSkipOutro,
    skipOutroSeconds,
    adBlockEnabled,
  } = usePlayerSettings();

  // 回调 refs 避免闭包问题
  const onErrorRef = useRef(onError);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onResolutionChangeRef = useRef(onResolutionChange);
  const onNextEpisodeRef = useRef(onNextEpisode);

  useEffect(() => {
    onErrorRef.current = onError;
    onTimeUpdateRef.current = onTimeUpdate;
    onResolutionChangeRef.current = onResolutionChange;
    onNextEpisodeRef.current = onNextEpisode;
  });

  // 清理看门狗定时器
  const clearWatchdog = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  }, []);

  // 启动看门狗定时器（25 秒超时）
  const startWatchdog = useCallback(() => {
    clearWatchdog();
    watchdogTimerRef.current = setTimeout(() => {
      console.error('[ArtPlayer] Watchdog timeout: video did not start playing within 25s');
      onErrorRef.current?.('视频加载超时，请重试或尝试换源');
    }, 25000);
  }, [clearWatchdog]);

  // 检查是否可以自动下一集
  const canAdvanceToNext = useCallback(() => {
    if (totalEpisodes <= 1) return false;
    const nextEpisodeFn = onNextEpisodeRef.current;
    if (!isReversed) {
      return currentEpisodeIndex < totalEpisodes - 1 && !!nextEpisodeFn;
    } else {
      return currentEpisodeIndex > 0 && !!nextEpisodeFn;
    }
  }, [totalEpisodes, currentEpisodeIndex, isReversed]);

  // 触发下一集
  const triggerNextEpisode = useCallback(
    (reason: string) => {
      if (!onNextEpisodeRef.current) return;
      if (lastHandledSrcRef.current === src) {
        console.log(`[ArtPlayer] Ignoring ${reason} trigger: already handled for this source`);
        return;
      }
      console.log(`[ArtPlayer] Triggering next episode via ${reason}`);
      lastHandledSrcRef.current = src;
      onNextEpisodeRef.current();
    },
    [src]
  );

  // 自定义 hls.js 集成（支持去广告）
  const setupHls = useCallback(
    (video: HTMLVideoElement, url: string, art: Artplayer) => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
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
        // 去广告自定义 loader
        ...(adBlockEnabled && {
          loader: AdFilterLoader as unknown as typeof Hls.DefaultConfig.loader,
          loaderConfig: {
            baseUrl: url,
            enabled: true,
          },
        }),
      });

      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[ArtPlayer] HLS manifest parsed');
        // HEVC 检测
        const levels = hls.levels;
        if (levels && levels.length > 0) {
          const hasHEVC = levels.some(
            (level) =>
              level.videoCodec?.toLowerCase().includes('hev') ||
              level.videoCodec?.toLowerCase().includes('h265')
          );
          if (hasHEVC) {
            console.warn('[ArtPlayer] HEVC/H.265 codec detected - may not play in all browsers');
            art.notice.show = '检测到 HEVC 编码，部分浏览器可能不支持';
          }
        }
      });

      let networkErrorRetries = 0;
      let mediaErrorRetries = 0;
      const MAX_RETRIES = 2;

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR: {
              const status = data.response?.code;
              if (status === 401 || status === 403 || status === 451) {
                console.error(`[ArtPlayer] Source refused access (HTTP ${status})`);
                onErrorRef.current?.('源站拒绝访问（地区限制或防盗链），自动切换代理重试');
                hls.destroy();
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
                onErrorRef.current?.('网络错误：无法加载视频流');
                hls.destroy();
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
                onErrorRef.current?.('媒体错误：视频格式不支持或已损坏');
                hls.destroy();
              }
              break;
            default:
              console.error('[ArtPlayer] Fatal error, cannot recover:', data);
              onErrorRef.current?.(`致命错误：${data.details || '未知错误'}`);
              hls.destroy();
              break;
          }
        }
      });
    },
    [adBlockEnabled]
  );

  // 初始化 ArtPlayer
  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    // 源没变化且播放器已存在，直接 switchUrl
    if (artRef.current && lastSrcRef.current === src) {
      return;
    }

    // 源变化了，销毁旧的播放器
    if (artRef.current && lastSrcRef.current !== src) {
      console.log('[ArtPlayer] Source changed, destroying old instance');
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      artRef.current.destroy(false);
      artRef.current = null;
    }

    lastSrcRef.current = src;
    hasSkippedIntroRef.current = false;
    hasTriggeredOutroSkipRef.current = false;

    console.log('[ArtPlayer] Initializing new player instance');

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    import('artplayer').then((ArtplayerModule) => {
      const Artplayer = ArtplayerModule.default;

      const art = new Artplayer({
        container: containerRef.current!,
        url: src,
        poster: poster,
        autoplay: shouldAutoPlay,
        autoSize: true,
        pip: true,
        fullscreen: true,
        fullscreenWeb: true,
        setting: true,
        playbackRate: true,
        aspectRatio: true,
        screenshot: true,
        lang: 'zh-cn',
        // 移动端配置
        ...(isMobile && {
          lock: true,
          fastForward: true,
          autoOrientation: true,
          gesture: true,
        }),
        // 自定义 hls.js 集成
        customType: {
          m3u8: setupHls,
        },
      });

      artRef.current = art;

      // ready 事件：跳转到初始时间
      art.on('ready', () => {
        console.log('[ArtPlayer] Player ready');
        if (initialTime > 0) {
          art.currentTime = initialTime;
          console.log(`[ArtPlayer] Seeked to initial time: ${initialTime}s`);
        }
        startWatchdog();
      });

      // video:loadedmetadata：读取分辨率
      art.on('video:loadedmetadata', () => {
        const video = art.video;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          onResolutionChangeRef.current?.({
            width: video.videoWidth,
            height: video.videoHeight,
          });
        }
      });

      // video:playing / video:canplay：清除看门狗
      art.on('video:playing', () => clearWatchdog());
      art.on('video:canplay', () => clearWatchdog());

      // video:timeupdate：断点续播、跳片头片尾
      art.on('video:timeupdate', () => {
        const currentTime = art.currentTime;
        const duration = art.duration;

        // 回调上层
        onTimeUpdateRef.current?.(currentTime, duration);

        // 自动跳过片头
        if (
          autoSkipIntro &&
          skipIntroSeconds > 0 &&
          !hasSkippedIntroRef.current &&
          currentTime < skipIntroSeconds &&
          duration > 0
        ) {
          art.currentTime = skipIntroSeconds;
          hasSkippedIntroRef.current = true;
          art.notice.show = `已自动跳过片头 ${skipIntroSeconds} 秒`;
          console.log(`[ArtPlayer] Auto-skipped intro to ${skipIntroSeconds}s`);
        }

        // 自动跳过片尾
        if (
          autoSkipOutro &&
          skipOutroSeconds > 0 &&
          !hasTriggeredOutroSkipRef.current &&
          duration > 0 &&
          duration - currentTime <= skipOutroSeconds
        ) {
          hasTriggeredOutroSkipRef.current = true;
          if (autoNextEpisode && canAdvanceToNext()) {
            triggerNextEpisode('outro-skip');
          } else {
            art.notice.show = '片尾剩余内容已自动跳过';
            console.log('[ArtPlayer] Auto-skipped outro');
          }
        }
      });

      // video:ended：自动下一集
      art.on('video:ended', () => {
        console.log('[ArtPlayer] Video ended');
        if (autoNextEpisode && canAdvanceToNext()) {
          triggerNextEpisode('video-ended');
        }
      });

      // video:error：错误处理
      art.on('video:error', () => {
        console.error('[ArtPlayer] Video error');
        clearWatchdog();
        const video = art.video;
        const errorMsg =
          video.error?.message || video.error?.code
            ? `视频错误 (code: ${video.error.code})`
            : '视频播放失败';
        onErrorRef.current?.(errorMsg);
      });
    });

    return () => {
      clearWatchdog();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (artRef.current) {
        artRef.current.destroy(false);
        artRef.current = null;
      }
    };
  }, [
    src,
    poster,
    shouldAutoPlay,
    initialTime,
    setupHls,
    clearWatchdog,
    startWatchdog,
    autoSkipIntro,
    skipIntroSeconds,
    autoSkipOutro,
    skipOutroSeconds,
    autoNextEpisode,
    canAdvanceToNext,
    triggerNextEpisode,
  ]);

  return (
    <div
      ref={containerRef}
      className="artplayer-container"
      style={{ width: '100%', height: '100%', minHeight: '400px' }}
    />
  );
}
