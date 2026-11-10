'use client';

import { useEffect, useRef } from 'react';
import type Artplayer from 'artplayer';
import type { Setting, SettingOption } from 'artplayer';
import Hls from 'hls.js';
import { usePlayerSettings } from './hooks/usePlayerSettings';
import { AdFilterLoader } from '@/lib/utils/hls-ad-filter-loader';
import {
  LONG_PRESS_SPEED_MAX,
  LONG_PRESS_SPEED_MIN,
  LONG_PRESS_SPEED_STEP,
  normalizeLongPressSpeed,
} from '@/lib/utils/player-speed';

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

const STORAGE_PLAYBACK_RATE_KEY = 'artplayer_playback_rate';
const STORAGE_ASPECT_RATIO_KEY = 'artplayer_aspect_ratio';

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

  // 使用 refs 保持最新设置，避免 effect 频繁重新执行
  const settingsRef = useRef({
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

  const callbacksRef = useRef({
    onError,
    onTimeUpdate,
    onResolutionChange,
    onNextEpisode,
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

  const initPropsRef = useRef({ poster, shouldAutoPlay, initialTime });
  useEffect(() => {
    initPropsRef.current = { poster, shouldAutoPlay, initialTime };
  });

  useEffect(() => {
    callbacksRef.current = {
      onError,
      onTimeUpdate,
      onResolutionChange,
      onNextEpisode,
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

  // 清理看门狗
  const clearWatchdog = () => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  };

  const startWatchdog = () => {
    clearWatchdog();
    watchdogTimerRef.current = setTimeout(() => {
      console.error('[ArtPlayer] Watchdog timeout: video did not start playing within 25s');
      callbacksRef.current.onError?.('视频加载超时，请重试或尝试换源');
    }, 25000);
  };

  const canAdvanceToNext = () => {
    const { totalEpisodes: total, currentEpisodeIndex: cur, isReversed: rev } = settingsRef.current;
    if (total <= 1) return false;
    const nextEpisodeFn = callbacksRef.current.onNextEpisode;
    if (!rev) {
      return cur < total - 1 && !!nextEpisodeFn;
    } else {
      return cur > 0 && !!nextEpisodeFn;
    }
  };

  const triggerNextEpisode = (reason: string) => {
    const fn = callbacksRef.current.onNextEpisode;
    if (!fn) return;
    if (lastHandledSrcRef.current === src) {
      return;
    }
    console.log(`[ArtPlayer] Triggering next episode via ${reason}`);
    lastHandledSrcRef.current = src;
    fn();
  };

  // 创建快捷设置项（注入到 ArtPlayer 设置面板中）
  const buildCustomSettings = (art: Artplayer): Setting[] => {
    return [
      {
        html: '自动连播',
        tooltip: settingsRef.current.autoNextEpisode ? '开启' : '关闭',
        switch: settingsRef.current.autoNextEpisode,
        onSwitch: function (item: SettingOption) {
          const next = !item.switch;
          item.switch = next;
          item.tooltip = next ? '开启' : '关闭';
          callbacksRef.current.setAutoNextEpisode(next);
          art.notice.show = `自动连播已${next ? '开启' : '关闭'}`;
          return next;
        },
      },
      {
        html: '跳过片头',
        tooltip: settingsRef.current.autoSkipIntro
          ? `${settingsRef.current.skipIntroSeconds}s`
          : '关闭',
        switch: settingsRef.current.autoSkipIntro,
        onSwitch: function (item: SettingOption) {
          const next = !item.switch;
          item.switch = next;
          item.tooltip = next ? `${settingsRef.current.skipIntroSeconds}s` : '关闭';
          callbacksRef.current.setAutoSkipIntro(next);
          art.notice.show = `跳过片头已${next ? '开启' : '关闭'}`;
          return next;
        },
      },
      {
        html: '片头秒数',
        width: 200,
        tooltip: `${settingsRef.current.skipIntroSeconds}s`,
        range: [settingsRef.current.skipIntroSeconds, 0, 300, 5],
        onChange: function (item: SettingOption) {
          const val = item.$range?.valueAsNumber ?? Number(item.range[0] ?? 0);
          const tooltip = `${val}s`;
          item.tooltip = tooltip;
          callbacksRef.current.setSkipIntroSeconds(val);
          return tooltip;
        },
      },
      {
        html: '跳过片尾',
        tooltip: settingsRef.current.autoSkipOutro
          ? `${settingsRef.current.skipOutroSeconds}s`
          : '关闭',
        switch: settingsRef.current.autoSkipOutro,
        onSwitch: function (item: SettingOption) {
          const next = !item.switch;
          item.switch = next;
          item.tooltip = next ? `${settingsRef.current.skipOutroSeconds}s` : '关闭';
          callbacksRef.current.setAutoSkipOutro(next);
          art.notice.show = `跳过片尾已${next ? '开启' : '关闭'}`;
          return next;
        },
      },
      {
        html: '片尾秒数',
        width: 200,
        tooltip: `${settingsRef.current.skipOutroSeconds}s`,
        range: [settingsRef.current.skipOutroSeconds, 0, 300, 5],
        onChange: function (item: SettingOption) {
          const val = item.$range?.valueAsNumber ?? Number(item.range[0] ?? 0);
          const tooltip = `${val}s`;
          item.tooltip = tooltip;
          callbacksRef.current.setSkipOutroSeconds(val);
          return tooltip;
        },
      },
      {
        html: '自动去广告',
        tooltip: settingsRef.current.adBlockEnabled ? '开启' : '关闭',
        switch: settingsRef.current.adBlockEnabled,
        onSwitch: function (item: SettingOption) {
          const next = !item.switch;
          item.switch = next;
          item.tooltip = next ? '开启' : '关闭';
          callbacksRef.current.setAdBlockEnabled(next);
          art.notice.show = `自动去广告已${next ? '开启' : '关闭'}（切集生效）`;
          return next;
        },
      },
      {
        html: '分辨率指示',
        tooltip: settingsRef.current.showResolutionIndicator ? '显示' : '隐藏',
        switch: settingsRef.current.showResolutionIndicator,
        onSwitch: function (item: SettingOption) {
          const next = !item.switch;
          item.switch = next;
          item.tooltip = next ? '显示' : '隐藏';
          callbacksRef.current.setShowResolutionIndicator(next);
          return next;
        },
      },
      {
        html: '长按加速',
        tooltip: settingsRef.current.longPressSpeedEnabled ? '开启' : '关闭',
        switch: settingsRef.current.longPressSpeedEnabled,
        onSwitch: function (item: SettingOption) {
          const next = !item.switch;
          item.switch = next;
          item.tooltip = next ? '开启' : '关闭';
          callbacksRef.current.setLongPressSpeedEnabled(next);
          return next;
        },
      },
      {
        html: '长按倍速',
        width: 200,
        tooltip: `${settingsRef.current.longPressSpeed}X`,
        range: [
          settingsRef.current.longPressSpeed,
          LONG_PRESS_SPEED_MIN,
          LONG_PRESS_SPEED_MAX,
          LONG_PRESS_SPEED_STEP,
        ],
        onChange: function (item: SettingOption) {
          const val = normalizeLongPressSpeed(
            item.$range?.valueAsNumber ?? Number(item.range[0])
          );
          const tooltip = `${val}X`;
          item.tooltip = tooltip;
          callbacksRef.current.setLongPressSpeed(val);
          return tooltip;
        },
      },
      {
        html: '自定义长按倍速',
        width: 200,
        tooltip: `${settingsRef.current.longPressSpeed}X`,
        mounted: function (panel, item) {
          const wrap = document.createElement('div');
          wrap.className = 'art-speed-input-wrap';
          const input = document.createElement('input');
          input.type = 'number';
          input.className = 'art-speed-input';
          input.min = String(LONG_PRESS_SPEED_MIN);
          input.max = String(LONG_PRESS_SPEED_MAX);
          input.step = String(LONG_PRESS_SPEED_STEP);
          input.inputMode = 'decimal';
          input.value = String(settingsRef.current.longPressSpeed);
          const unit = document.createElement('span');
          unit.className = 'art-speed-input-unit';
          unit.textContent = 'X';

          const commit = () => {
            const val = normalizeLongPressSpeed(input.value);
            input.value = String(val);
            (item as SettingOption).tooltip = `${val}X`;
            callbacksRef.current.setLongPressSpeed(val);
          };
          input.addEventListener('change', commit);
          input.addEventListener('blur', commit);
          input.addEventListener('keydown', (e) => {
            if ((e as KeyboardEvent).key === 'Enter') {
              e.preventDefault();
              commit();
              (input as HTMLInputElement).blur();
            }
          });

          wrap.appendChild(input);
          wrap.appendChild(unit);
          const rightEl = panel.querySelector('.art-setting-item-right');
          (rightEl || panel).appendChild(wrap);
        },
      },
      {
        html: '模式指示器',
        tooltip: settingsRef.current.showModeIndicator ? '显示' : '隐藏',
        switch: settingsRef.current.showModeIndicator,
        onSwitch: function (item: SettingOption) {
          const next = !item.switch;
          item.switch = next;
          item.tooltip = next ? '显示' : '隐藏';
          callbacksRef.current.setShowModeIndicator(next);
          return next;
        },
      },
    ];
  };

  // 初始化 ArtPlayer
  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    if (artRef.current && lastSrcRef.current === src) {
      return;
    }

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

    // 按 URL 自动判断播放类型：m3u8/hls 走 hls.js，其余交给浏览器原生播放
    // 代理地址没有扩展名，优先用原始地址判断
    const detectType = (u: string): 'm3u8' | 'mp4' | 'auto' => {
      const path = u.split('?')[0].toLowerCase();
      if (path.endsWith('.m3u8') || path.includes('.m3u8')) return 'm3u8';
      if (path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.mkv')) return 'mp4';
      return 'auto';
    };
    const originalType = detectType(sourceUrl || src);
    const videoType = originalType === 'auto' ? detectType(src) : originalType;

    // 屏幕常亮（移动端播放时不自动熄屏）
    let wakeLock: { release: () => Promise<void> } | null = null;
    const requestWakeLock = () => {
      if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
      if (wakeLock) return;
      (
        navigator as Navigator & {
          wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> };
        }
      ).wakeLock
        .request('screen')
        .then((lock) => {
          wakeLock = lock;
        })
        .catch(() => {
          wakeLock = null;
        });
    };
    const releaseWakeLock = () => {
      if (!wakeLock) return;
      const lock = wakeLock;
      wakeLock = null;
      lock.release().catch(() => {});
    };

    let cancelled = false;

    import('artplayer').then((ArtplayerModule) => {
      if (cancelled || !containerRef.current) return;
      const Artplayer = ArtplayerModule.default;

      // 自定义 HLS 集成
      const setupHls = (video: HTMLVideoElement, url: string, art: Artplayer) => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        const isAdFilterOn = settingsRef.current.adBlockEnabled;

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
          ...(isAdFilterOn && {
            loader: AdFilterLoader as unknown as typeof Hls.DefaultConfig.loader,
          }),
        });

        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('[ArtPlayer] HLS manifest parsed');
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

            // 如果有多码率/多分辨率，生成清晰度切换菜单
            if (levels.length > 1) {
              const qualityList = levels.map((lvl, idx) => ({
                default: idx === hls.currentLevel,
                html: lvl.name || (lvl.height ? `${lvl.height}P` : `级别 ${idx + 1}`),
                level: idx,
              }));
              // 加入自动档
              qualityList.unshift({
                default: hls.autoLevelEnabled,
                html: '自动',
                level: -1,
              });

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
                  callbacksRef.current.onError?.(
                    '源站拒绝访问（地区限制或防盗链），自动切换代理重试'
                  );
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
                  callbacksRef.current.onError?.('网络错误：无法加载视频流');
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
                  callbacksRef.current.onError?.('媒体错误：视频格式不支持或已损坏');
                  hls.destroy();
                }
                break;
              default:
                console.error('[ArtPlayer] Fatal error, cannot recover:', data);
                callbacksRef.current.onError?.(`致命错误：${data.details || '未知错误'}`);
                hls.destroy();
                break;
            }
          }
        });
      };

      // 从 localStorage 读取记忆的倍速和画面比例
      let savedPlaybackRate = 1.0;
      let savedAspectRatio = 'default';
      if (typeof window !== 'undefined') {
        const storedRate = localStorage.getItem(STORAGE_PLAYBACK_RATE_KEY);
        if (storedRate) {
          const num = parseFloat(storedRate);
          if (!isNaN(num) && num > 0) savedPlaybackRate = num;
        }
        const storedRatio = localStorage.getItem(STORAGE_ASPECT_RATIO_KEY);
        if (storedRatio) savedAspectRatio = storedRatio;
      }

      const art = new Artplayer({
        container: containerRef.current!,
        url: src,
        type: videoType === 'mp4' ? 'mp4' : 'm3u8',
        autoplay: initPropsRef.current.shouldAutoPlay,
        ...(typeof initPropsRef.current.poster === 'string' && initPropsRef.current.poster
          ? { poster: initPropsRef.current.poster }
          : {}),
        autoSize: false,
        autoMini: false,
        pip: true,
        fullscreen: true,
        fullscreenWeb: true,
        setting: true,
        playbackRate: true,
        aspectRatio: true,
        screenshot: true,
        hotkey: true,
        lang: 'zh-cn',
        playsInline: true,
        // 移动端专用配置（fastForward 用内置的固定 3 倍速且无视设置项，
        // 长按加速由下方自定义 touch 逻辑实现，尊重“长按加速/长按倍速”设置）
        ...(isMobile && {
          lock: true,
          autoOrientation: true,
          gesture: false,
        }),
        customType: {
          m3u8: setupHls,
          hls: setupHls,
        },
      });

      artRef.current = art;

      // 移动端全屏适配：iOS/Android 浏览器普遍不支持对非 video 元素调用
      // 原生 requestFullscreen，导致点“全屏”没反应。这里在移动端把原生全屏
      // 按钮的行为改为切换 ArtPlayer 的网页全屏（position:fixed 撑满视口）。
      if (isMobile) {
        const redirectFullscreen = (e: Event) => {
          const target = e.target as HTMLElement | null;
          if (!target) return;
          const nativeFsBtn = target.closest('.art-control-fullscreen');
          if (nativeFsBtn && !target.closest('.art-control-fullscreenWeb')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            art.fullscreenWeb = !art.fullscreenWeb;
          }
        };
        (art as unknown as { __mobileFullscreenHandler?: (e: Event) => void }).__mobileFullscreenHandler =
          redirectFullscreen;
        const controlsEl = art.template?.$controls;
        if (controlsEl) {
          controlsEl.addEventListener('click', redirectFullscreen, true);
        }
      }

      // 注册设置面板里的自定义选项
      try {
        const customSettings = buildCustomSettings(art);
        customSettings.forEach((s) => art.setting.add(s));
      } catch (err) {
        console.warn('[ArtPlayer] Failed to add custom settings:', err);
      }

      // 恢复记忆的画面比例
      if (settingsRef.current.rememberPlayerState && savedAspectRatio !== 'default') {
        try {
          art.aspectRatio = savedAspectRatio as unknown as typeof art.aspectRatio;
        } catch {
          // ignore
        }
      }

      // 监听倍速变化并持久化（长按加速的临时倍速不记忆）
      art.on('video:ratechange', () => {
        const currentRate = art.playbackRate;
        if (!isSpeedBoosting && settingsRef.current.rememberPlayerState && currentRate > 0) {
          try {
            localStorage.setItem(STORAGE_PLAYBACK_RATE_KEY, String(currentRate));
          } catch {
            // ignore
          }
        }
      });

      // 监听画面比例变化并持久化
      art.on('aspectRatio', (ratio) => {
        if (settingsRef.current.rememberPlayerState && ratio) {
          try {
            localStorage.setItem(STORAGE_ASPECT_RATIO_KEY, String(ratio));
          } catch {
            // ignore
          }
        }
      });

      // 桌面端长按加速状态
      let isSpeedBoosting = false;
      let originalPlaybackRate = 1.0;
      let spaceLongPressTimer: NodeJS.Timeout | null = null;
      let mouseLongPressTimer: NodeJS.Timeout | null = null;

      const startSpeedBoost = (reason = '长按加速') => {
        if (isSpeedBoosting || !settingsRef.current.longPressSpeedEnabled) return;
        if (!art.duration || art.duration <= 0) return;
        isSpeedBoosting = true;
        originalPlaybackRate = art.playbackRate;
        const targetRate = normalizeLongPressSpeed(settingsRef.current.longPressSpeed);
        art.playbackRate = targetRate;
        art.notice.show = `${reason} ${targetRate}X`;
      };

      const stopSpeedBoost = () => {
        if (!isSpeedBoosting) return;
        isSpeedBoosting = false;
        art.playbackRate = originalPlaybackRate;
        art.notice.show = `恢复 ${originalPlaybackRate}X`;
      };

      // 控制条“长按加速”按钮：按住按设定倍速播放，松开恢复。
      // 通过事件委托在容器层处理，避免 ArtPlayer 重建控件导致监听器丢失。
      const isBoostButton = (target: EventTarget | null): HTMLElement | null => {
        const el = target as HTMLElement | null;
        if (!el || typeof el.closest !== 'function') return null;
        return el.closest('.art-control-speedBoost') as HTMLElement | null;
      };
      let boostBtnActive: HTMLElement | null = null;
      const beginBoostPress = (target: EventTarget | null, event: Event) => {
        const btn = isBoostButton(target);
        if (!btn) return false;
        event.preventDefault();
        event.stopPropagation();
        startSpeedBoost('长按加速');
        if (isSpeedBoosting) {
          boostBtnActive = btn;
          btn.classList.add('art-speed-boost-active');
        }
        return true;
      };
      const endBoostPress = () => {
        if (boostBtnActive) {
          boostBtnActive.classList.remove('art-speed-boost-active');
          boostBtnActive = null;
        }
        stopSpeedBoost();
      };

      // 创建按钮（样式在 video-player.css 中定义）
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

      // 空格：短按切换播放/暂停，长按加速。拦截 ArtPlayer 自带的 keydown 切换逻辑
      let spaceDown = false;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code !== 'Space') return;
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        ) {
          return;
        }
        if (!art.isFocus) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat || spaceDown) return;
        spaceDown = true;
        if (spaceLongPressTimer) clearTimeout(spaceLongPressTimer);
        spaceLongPressTimer = setTimeout(() => startSpeedBoost('空格加速'), 300);
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code !== 'Space' || !spaceDown) return;
        spaceDown = false;
        if (spaceLongPressTimer) {
          clearTimeout(spaceLongPressTimer);
          spaceLongPressTimer = null;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        if (isSpeedBoosting) {
          stopSpeedBoost();
        } else {
          art.toggle();
        }
      };

      // 桌面端鼠标长按视频画面加速
      const containerElForCleanup = containerRef.current;
      const handleMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return; // 仅左键
        // 长按加速按钮：按住即加速（鼠标/触摸统一）
        if (beginBoostPress(e.target, e)) return;
        if (isMobile) return;
        const target = e.target as HTMLElement | null;
        // 如果点击的是控制条、设置菜单、右键菜单等 UI，不触发长按加速
        if (target && target.closest('.art-control, .art-controls, .art-settings, .art-contextmenu')) {
          return;
        }
        if (mouseLongPressTimer) clearTimeout(mouseLongPressTimer);
        mouseLongPressTimer = setTimeout(() => {
          startSpeedBoost('长按加速');
          if (isSpeedBoosting) suppressNextClick = true;
        }, 350);
      };

      let suppressNextClick = false;
      const handleClickCapture = (e: MouseEvent) => {
        if (!suppressNextClick) return;
        suppressNextClick = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      };

      const handleMouseUp = () => {
        if (mouseLongPressTimer) {
          clearTimeout(mouseLongPressTimer);
          mouseLongPressTimer = null;
        }
        endBoostPress();
      };

      // 移动端触摸长按加速：与桌面逻辑一致，尊重“长按加速/长按倍速”设置。
      // 滑动（touchmove）时取消/立即恢复，避免与滑动快进手势冲突。
      let touchLongPressTimer: NodeJS.Timeout | null = null;
      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length !== 1 || art.isLock) return;
        // 长按加速按钮：按住即加速
        if (beginBoostPress(e.target, e)) return;
        if (!isMobile) return;
        const target = e.target as HTMLElement | null;
        if (
          target &&
          target.closest(
            '.art-control, .art-controls, .art-progress, .art-settings, .art-contextmenu, .art-layer, .art-layer-lock, .art-state'
          )
        ) {
          return;
        }
        if (touchLongPressTimer) clearTimeout(touchLongPressTimer);
        touchLongPressTimer = setTimeout(() => {
          startSpeedBoost('长按加速');
          if (isSpeedBoosting) suppressNextClick = true;
        }, 350);
      };
      const handleTouchMove = () => {
        if (touchLongPressTimer) {
          clearTimeout(touchLongPressTimer);
          touchLongPressTimer = null;
        }
        if (isSpeedBoosting) stopSpeedBoost();
      };
      const handleTouchEnd = () => {
        if (touchLongPressTimer) {
          clearTimeout(touchLongPressTimer);
          touchLongPressTimer = null;
        }
        endBoostPress();
      };
      const handleContextMenu = (event: Event) => {
        if (!isMobile) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      };

      window.addEventListener('keydown', handleKeyDown, true);
      window.addEventListener('keyup', handleKeyUp, true);
      containerElForCleanup?.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mouseup', handleMouseUp);
      containerRef.current?.addEventListener('click', handleClickCapture, true);
      containerElForCleanup?.addEventListener('touchstart', handleTouchStart, { passive: true });
      containerElForCleanup?.addEventListener('contextmenu', handleContextMenu, true);
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleTouchEnd, { passive: true });
      window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

      // ready 事件：跳转到初始时间 & 恢复倍速
      art.on('ready', () => {
        console.log('[ArtPlayer] Player ready');
        const startAt = initPropsRef.current.initialTime;
        if (startAt > 0) {
          art.currentTime = startAt;
          console.log(`[ArtPlayer] Seeked to initial time: ${startAt}s`);
        }
        if (settingsRef.current.rememberPlayerState && savedPlaybackRate !== 1.0) {
          art.playbackRate = savedPlaybackRate;
          console.log(`[ArtPlayer] Restored playback rate: ${savedPlaybackRate}X`);
        }
        startWatchdog();
      });

      // video:loadedmetadata：读取分辨率
      art.on('video:loadedmetadata', () => {
        const video = art.video;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          callbacksRef.current.onResolutionChange?.({
            width: video.videoWidth,
            height: video.videoHeight,
          });
        }
      });

      // video:playing / video:canplay：清除看门狗
      art.on('video:playing', () => {
        clearWatchdog();
        requestWakeLock();
      });
      art.on('video:canplay', () => clearWatchdog());
      art.on('video:pause', () => releaseWakeLock());

      // video:timeupdate：断点续播、跳片头片尾
      art.on('video:timeupdate', () => {
        const currentTime = art.currentTime;
        const duration = art.duration;

        callbacksRef.current.onTimeUpdate?.(currentTime, duration);

        const {
          autoSkipIntro: skipIntro,
          skipIntroSeconds: introSec,
          autoSkipOutro: skipOutro,
          skipOutroSeconds: outroSec,
          autoNextEpisode: nextEp,
        } = settingsRef.current;

        // 自动跳过片头
        if (
          skipIntro &&
          introSec > 0 &&
          !hasSkippedIntroRef.current &&
          currentTime < introSec &&
          duration > 0
        ) {
          art.currentTime = introSec;
          hasSkippedIntroRef.current = true;
          art.notice.show = `已自动跳过片头 ${introSec} 秒`;
          console.log(`[ArtPlayer] Auto-skipped intro to ${introSec}s`);
        }

        // 自动跳过片尾
        if (
          skipOutro &&
          outroSec > 0 &&
          !hasTriggeredOutroSkipRef.current &&
          duration > 0 &&
          duration - currentTime <= outroSec
        ) {
          hasTriggeredOutroSkipRef.current = true;
          if (nextEp && canAdvanceToNext()) {
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
        if (settingsRef.current.autoNextEpisode && canAdvanceToNext()) {
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
        callbacksRef.current.onError?.(errorMsg);
      });

      // 清理函数（挂在 art 实例上以便在 effect cleanup 中调用）
      (art as unknown as { __customCleanup: () => void }).__customCleanup = () => {
        window.removeEventListener('keydown', handleKeyDown, true);
        window.removeEventListener('keyup', handleKeyUp, true);
        containerElForCleanup?.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mouseup', handleMouseUp);
        containerElForCleanup?.removeEventListener('touchstart', handleTouchStart);
        containerElForCleanup?.removeEventListener('contextmenu', handleContextMenu, true);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        window.removeEventListener('touchcancel', handleTouchEnd);
        containerElForCleanup?.removeEventListener('click', handleClickCapture, true);
        const mobileHandler = (art as unknown as { __mobileFullscreenHandler?: (e: Event) => void })
          .__mobileFullscreenHandler;
        if (mobileHandler) {
          art.template.$controls.removeEventListener('click', mobileHandler, true);
        }
        if (spaceLongPressTimer) clearTimeout(spaceLongPressTimer);
        if (mouseLongPressTimer) clearTimeout(mouseLongPressTimer);
        if (touchLongPressTimer) clearTimeout(touchLongPressTimer);
      };
    });

    return () => {
      cancelled = true;
      clearWatchdog();
      releaseWakeLock();
      if (artRef.current) {
        const cleanup = (artRef.current as unknown as { __customCleanup?: () => void })
          .__customCleanup;
        cleanup?.();
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (artRef.current) {
        artRef.current.destroy(false);
        artRef.current = null;
      }
    };
    // poster/autoplay/initialTime 通过 ref 读取：它们随观看进度变化，不能触发播放器重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <div
      ref={containerRef}
      className="artplayer-container w-full h-full"
    />
  );
}
