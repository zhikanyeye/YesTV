'use client';

import { useEffect, useRef } from 'react';
import type Artplayer from 'artplayer';
import type { Setting } from 'artplayer';
import Hls from 'hls.js';
import { usePlayerSettings } from './hooks/usePlayerSettings';
import {
  buildCustomSettings,
} from './artplayer/settings-panel';
import {
  createWatchdog,
  type Watchdog,
} from './artplayer/watchdog';
import {
  createWakeLock,
} from './artplayer/wake-lock';
import {
  setupLongPressSpeed,
  type LongPressSpeedController,
} from './artplayer/long-press-speed';
import { createHlsLoader } from './artplayer/hls';
import { resolveMediaType } from './artplayer/media-type';
import { resolveCapabilityOptions } from './artplayer/player-options';
import {
  loadPersistedPlayerState,
  saveAspectRatio,
  savePlaybackRate,
} from './artplayer/storage';
import type {
  PlayerSettingCallbacks,
  PlayerSettingsSnapshot,
} from './artplayer/types';

interface ArtVideoPlayerProps {
  src: string;
  /** 原始播放地址（未经代理），用于判断真实媒体类型 */
  sourceUrl?: string;
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
  sourceUrl,
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
    showModeIndicator,
    showResolutionIndicator,
    longPressSpeed,
    longPressSpeedEnabled,
    rememberPlayerState,
    setAutoNextEpisode,
    setAutoSkipIntro,
    setSkipIntroSeconds,
    setAutoSkipOutro,
    setSkipOutroSeconds,
    setAdBlockEnabled,
    setShowModeIndicator,
    setShowResolutionIndicator,
    setLongPressSpeed,
    setLongPressSpeedEnabled,
  } = usePlayerSettings();

  // 使用 refs 保持最新设置与回调，避免 effect 频繁重新执行
  const settingsRef = useRef<PlayerSettingsSnapshot>({
    autoNextEpisode,
    autoSkipIntro,
    skipIntroSeconds,
    autoSkipOutro,
    skipOutroSeconds,
    adBlockEnabled,
    showModeIndicator,
    showResolutionIndicator,
    longPressSpeed,
    longPressSpeedEnabled,
    rememberPlayerState,
    totalEpisodes,
    currentEpisodeIndex,
    isReversed,
  });

  const callbacksRef = useRef<PlayerSettingCallbacks>({
    setAutoNextEpisode,
    setAutoSkipIntro,
    setSkipIntroSeconds,
    setAutoSkipOutro,
    setSkipOutroSeconds,
    setAdBlockEnabled,
    setShowModeIndicator,
    setShowResolutionIndicator,
    setLongPressSpeed,
    setLongPressSpeedEnabled,
  });

  const playerCallbacksRef = useRef({ onError, onTimeUpdate, onResolutionChange, onNextEpisode });
  const initPropsRef = useRef({ poster, shouldAutoPlay, initialTime });

  useEffect(() => {
    settingsRef.current = {
      autoNextEpisode,
      autoSkipIntro,
      skipIntroSeconds,
      autoSkipOutro,
      skipOutroSeconds,
      adBlockEnabled,
      showModeIndicator,
      showResolutionIndicator,
      longPressSpeed,
      longPressSpeedEnabled,
      rememberPlayerState,
      totalEpisodes,
      currentEpisodeIndex,
      isReversed,
    };
  });

  useEffect(() => {
    callbacksRef.current = {
      setAutoNextEpisode,
      setAutoSkipIntro,
      setSkipIntroSeconds,
      setAutoSkipOutro,
      setSkipOutroSeconds,
      setAdBlockEnabled,
      setShowModeIndicator,
      setShowResolutionIndicator,
      setLongPressSpeed,
      setLongPressSpeedEnabled,
    };
  });

  useEffect(() => {
    playerCallbacksRef.current = { onError, onTimeUpdate, onResolutionChange, onNextEpisode };
  });

  useEffect(() => {
    initPropsRef.current = { poster, shouldAutoPlay, initialTime };
  });

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    // 同一 src 不重建；src 变化时先销毁旧实例
    if (artRef.current && lastSrcRef.current === src) return;
    if (artRef.current && lastSrcRef.current !== src) {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      artRef.current.destroy(false);
      artRef.current = null;
    }

    lastSrcRef.current = src;
    hasSkippedIntroRef.current = false;
    hasTriggeredOutroSkipRef.current = false;
    lastHandledSrcRef.current = '';
    playerCallbacksRef.current.onResolutionChange?.(null);

    const container = containerRef.current;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const mediaType = resolveMediaType(sourceUrl, src);
    const persisted = loadPersistedPlayerState();
    const wakeLock = createWakeLock();

    let cancelled = false;
    let longPressController: LongPressSpeedController | null = null;
    let watchdog: Watchdog | null = null;
    let artInstance: Artplayer | null = null;

    // 看门狗：视频长时间未开始播放则报错
    watchdog = createWatchdog(() => {
      console.error('[ArtPlayer] Watchdog timeout: video did not start playing within 25s');
      playerCallbacksRef.current.onError?.('视频加载超时，请重试或尝试换源');
    });

    const canAdvanceToNext = () => {
      const { totalEpisodes: total, currentEpisodeIndex: cur, isReversed: rev } = settingsRef.current;
      if (total <= 1) return false;
      if (!playerCallbacksRef.current.onNextEpisode) return false;
      return rev ? cur > 0 : cur < total - 1;
    };

    const triggerNextEpisode = (reason: string) => {
      const fn = playerCallbacksRef.current.onNextEpisode;
      if (!fn) return;
      if (lastHandledSrcRef.current === src) return;
      console.log(`[ArtPlayer] Triggering next episode via ${reason}`);
      lastHandledSrcRef.current = src;
      fn();
    };

    import('artplayer').then((ArtplayerModule) => {
      if (cancelled || !containerRef.current) return;
      const Artplayer = ArtplayerModule.default;

      const hlsLoader = createHlsLoader({
        getArt: () => artInstance,
        isAdBlockEnabled: () => settingsRef.current.adBlockEnabled,
        onError: (msg) => {
          watchdog?.clear();
          playerCallbacksRef.current.onError?.(msg);
        },
        setHls: (hls) => {
          // 替换前销毁旧实例，避免重复加载同一播放器时泄漏
          if (hlsRef.current && hlsRef.current !== hls) {
            hlsRef.current.destroy();
          }
          hlsRef.current = hls;
        },
      });

      const capabilities = resolveCapabilityOptions(isMobile);

      const art = new Artplayer({
        container: containerRef.current!,
        url: src,
        type: mediaType === 'mp4' ? 'mp4' : 'm3u8',
        autoplay: initPropsRef.current.shouldAutoPlay,
        ...(typeof initPropsRef.current.poster === 'string' && initPropsRef.current.poster
          ? { poster: initPropsRef.current.poster }
          : {}),
        autoSize: false,
        autoMini: false,
        // 移动端只保留一个全屏入口（原生全屏），桌面端保留 PiP 与双全屏
        pip: capabilities.pip,
        fullscreen: capabilities.fullscreen,
        fullscreenWeb: capabilities.fullscreenWeb,
        setting: true,
        playbackRate: true,
        aspectRatio: true,
        screenshot: true,
        hotkey: true,
        lang: 'zh-cn',
        playsInline: true,
        // 移动端：锁定与关闭内置手势，长按加速由自定义逻辑实现
        lock: capabilities.lock,
        gesture: capabilities.gesture,
        customType: {
          m3u8: hlsLoader,
          hls: hlsLoader,
        },
      });

      artRef.current = art;
      artInstance = art;
      watchdog?.start();

      // 注册设置面板自定义项
      try {
        const customSettings: Setting[] = buildCustomSettings(art, settingsRef, callbacksRef);
        customSettings.forEach((s) => art.setting.add(s));
      } catch (err) {
        console.warn('[ArtPlayer] Failed to add custom settings:', err);
      }

      // 恢复记忆的画面比例
      if (settingsRef.current.rememberPlayerState && persisted.aspectRatio !== 'default') {
        try {
          art.aspectRatio = persisted.aspectRatio as unknown as typeof art.aspectRatio;
        } catch {
          // ignore
        }
      }

      // 安装长按加速（桌面 + 移动端 + 控制条按钮）
      longPressController = setupLongPressSpeed({
        art,
        container,
        isMobile,
        getSettings: () => ({
          enabled: settingsRef.current.longPressSpeedEnabled,
          speed: settingsRef.current.longPressSpeed,
        }),
      });

      // 控制条“长按加速”按钮：桌面端显示，移动端控制条宽度有限，改用画面长按手势
      if (capabilities.showSpeedBoostButton) {
        try {
          art.controls.add({
            name: 'speedBoost',
            index: 25,
            position: 'right',
            html: '<span class="art-speed-boost-label">长按</span>',
            tooltip: `按住加速（${settingsRef.current.longPressSpeed}X）`,
          });
        } catch (e) {
          console.warn('[ArtPlayer] Failed to register speed boost button:', e);
        }
      }

      // 倍速变化持久化（长按加速的临时倍速不记忆）
      art.on('video:ratechange', () => {
        const rate = art.playbackRate as number;
        if (longPressController?.isBoosting()) return;
        if (settingsRef.current.rememberPlayerState && rate > 0) {
          savePlaybackRate(rate);
        }
      });

      // 画面比例变化持久化
      art.on('aspectRatio', (ratio) => {
        if (settingsRef.current.rememberPlayerState && ratio) {
          saveAspectRatio(String(ratio));
        }
      });

      // ready：跳转初始时间、恢复倍速
      art.on('ready', () => {
        const startAt = initPropsRef.current.initialTime;
        if (startAt > 0) art.currentTime = startAt;
        if (settingsRef.current.rememberPlayerState && persisted.playbackRate !== 1.0) {
          art.playbackRate = persisted.playbackRate;
        }
      });

      art.on('video:loadedmetadata', () => {
        const video = art.video;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          playerCallbacksRef.current.onResolutionChange?.({
            width: video.videoWidth,
            height: video.videoHeight,
          });
        }
      });

      art.on('video:playing', () => {
        watchdog?.clear();
        wakeLock.request();
      });
      art.on('video:canplay', () => watchdog?.clear());
      art.on('video:pause', () => wakeLock.release());

      art.on('video:timeupdate', () => {
        const currentTime = art.currentTime;
        const duration = art.duration;

        playerCallbacksRef.current.onTimeUpdate?.(currentTime, duration);

        const {
          autoSkipIntro: skipIntro,
          skipIntroSeconds: introSec,
          autoSkipOutro: skipOutro,
          skipOutroSeconds: outroSec,
          autoNextEpisode: nextEp,
        } = settingsRef.current;

        if (skipIntro && introSec > 0 && introSec < duration && !hasSkippedIntroRef.current && currentTime < introSec) {
          hasSkippedIntroRef.current = true;
          art.currentTime = introSec;
          art.notice.show = `已自动跳过片头 ${introSec} 秒`;
        }

        if (skipOutro && outroSec > 0 && outroSec < duration && !hasTriggeredOutroSkipRef.current && duration - currentTime <= outroSec) {
          hasTriggeredOutroSkipRef.current = true;
          if (nextEp && canAdvanceToNext()) {
            triggerNextEpisode('outro-skip');
          } else {
            art.pause();
            art.currentTime = duration;
            art.notice.show = '片尾剩余内容已自动跳过';
          }
        }
      });

      art.on('video:ended', () => {
        if (settingsRef.current.autoNextEpisode && canAdvanceToNext()) {
          triggerNextEpisode('video-ended');
        }
      });

      art.on('video:error', () => {
        watchdog?.clear();
        const video = art.video;
        const errorMsg =
          video.error?.message || (video.error?.code
            ? `视频错误 (code: ${video.error.code})`
            : '视频播放失败');
        playerCallbacksRef.current.onError?.(errorMsg);
      });
    }).catch(() => {
      if (cancelled) return;
      watchdog?.clear();
      playerCallbacksRef.current.onError?.('播放器初始化失败，请刷新页面重试');
    });

    return () => {
      cancelled = true;
      watchdog?.clear();
      wakeLock.release();
      longPressController?.destroy();
      hlsRef.current?.destroy();
      hlsRef.current = null;
      artRef.current?.destroy(false);
      artRef.current = null;
    };
    // poster/autoplay/initialTime 通过 ref 读取：它们随观看进度变化，不能触发播放器重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return <div ref={containerRef} className="artplayer-container w-full h-full" />;
}
