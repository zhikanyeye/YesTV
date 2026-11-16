/**
 * 长按加速：统一桌面空格、鼠标长按、移动端触摸长按与控制条按钮的加速交互。
 * 尊重“长按加速/长按倍速”设置，滑动时立即恢复，避免与快进手势冲突。
 */

import type Artplayer from 'artplayer';
import {
  LONG_PRESS_THRESHOLD_MS,
  SPACE_LONG_PRESS_MS,
  SPEED_BOOST_BUTTON_CLASS,
} from './constants';
import { normalizeLongPressSpeed } from '@/lib/utils/player-speed';

export interface LongPressSpeedContext {
  art: Artplayer;
  container: HTMLElement;
  isMobile: boolean;
  /** 读取当前长按加速设置 */
  getSettings: () => { enabled: boolean; speed: number };
}

export interface LongPressSpeedController {
  /** 当前是否处于加速状态（用于倍速持久化守卫） */
  isBoosting: () => boolean;
  /** 注销所有监听与定时器 */
  destroy: () => void;
}

/** 安装长按加速交互，返回控制器 */
export function setupLongPressSpeed(
  ctx: LongPressSpeedContext
): LongPressSpeedController {
  const { art, container, isMobile } = ctx;

  let isSpeedBoosting = false;
  let originalPlaybackRate = 1.0;
  let suppressNextClick = false;

  let spaceDown = false;
  let spaceLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  let mouseLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  let touchLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  let boostBtnActive: HTMLElement | null = null;

  const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
    if (timer) clearTimeout(timer);
    return null;
  };

  const startSpeedBoost = (reason = '长按加速') => {
    const { enabled, speed } = ctx.getSettings();
    if (isSpeedBoosting || !enabled) return;
    if (!art.duration || art.duration <= 0) return;
    isSpeedBoosting = true;
    originalPlaybackRate = art.playbackRate as number;
    const targetRate = normalizeLongPressSpeed(speed);
    art.playbackRate = targetRate;
    art.notice.show = `${reason} ${targetRate}X`;
  };

  const stopSpeedBoost = () => {
    if (!isSpeedBoosting) return;
    isSpeedBoosting = false;
    art.playbackRate = originalPlaybackRate;
    art.notice.show = `恢复 ${originalPlaybackRate}X`;
  };

  // 控制条“长按加速”按钮：通过事件委托处理，避免控件重建导致监听丢失
  const findBoostButton = (target: EventTarget | null): HTMLElement | null => {
    const el = target as HTMLElement | null;
    if (!el || typeof el.closest !== 'function') return null;
    return el.closest(`.${SPEED_BOOST_BUTTON_CLASS}`) as HTMLElement | null;
  };

  const beginBoostPress = (target: EventTarget | null, event: Event): boolean => {
    const btn = findBoostButton(target);
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

  // 空格：短按切换播放/暂停，长按加速
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
    spaceLongPressTimer = clearTimer(spaceLongPressTimer);
    spaceLongPressTimer = setTimeout(() => startSpeedBoost('空格加速'), SPACE_LONG_PRESS_MS);
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || !spaceDown) return;
    spaceDown = false;
    spaceLongPressTimer = clearTimer(spaceLongPressTimer);
    e.preventDefault();
    e.stopImmediatePropagation();
    if (isSpeedBoosting) {
      stopSpeedBoost();
    } else {
      art.toggle();
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (beginBoostPress(e.target, e)) return;
    if (isMobile) return;
    const target = e.target as HTMLElement | null;
    if (target && target.closest('.art-control, .art-controls, .art-settings, .art-contextmenu')) {
      return;
    }
    mouseLongPressTimer = clearTimer(mouseLongPressTimer);
    mouseLongPressTimer = setTimeout(() => {
      startSpeedBoost('长按加速');
      if (isSpeedBoosting) suppressNextClick = true;
    }, LONG_PRESS_THRESHOLD_MS);
  };

  const handleClickCapture = (e: MouseEvent) => {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  const handleMouseUp = () => {
    mouseLongPressTimer = clearTimer(mouseLongPressTimer);
    endBoostPress();
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1 || art.isLock) return;
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
    touchLongPressTimer = clearTimer(touchLongPressTimer);
    touchLongPressTimer = setTimeout(() => {
      startSpeedBoost('长按加速');
      if (isSpeedBoosting) suppressNextClick = true;
    }, LONG_PRESS_THRESHOLD_MS);
  };

  const handleTouchMove = () => {
    touchLongPressTimer = clearTimer(touchLongPressTimer);
    endBoostPress();
  };

  const handleTouchEnd = () => {
    touchLongPressTimer = clearTimer(touchLongPressTimer);
    endBoostPress();
  };

  const handleContextMenu = (event: Event) => {
    if (!isMobile) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const cancelPress = () => {
    spaceDown = false;
    spaceLongPressTimer = clearTimer(spaceLongPressTimer);
    mouseLongPressTimer = clearTimer(mouseLongPressTimer);
    touchLongPressTimer = clearTimer(touchLongPressTimer);
    suppressNextClick = false;
    endBoostPress();
  };

  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keyup', handleKeyUp, true);
  container.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mouseup', handleMouseUp);
  container.addEventListener('click', handleClickCapture, true);
  container.addEventListener('touchstart', handleTouchStart, { passive: false });
  window.addEventListener('blur', cancelPress);
  container.addEventListener('contextmenu', handleContextMenu, true);
  window.addEventListener('touchmove', handleTouchMove, { passive: true });
  window.addEventListener('touchend', handleTouchEnd, { passive: true });
  window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

  return {
    isBoosting: () => isSpeedBoosting,
    destroy: () => {
      cancelPress();
      window.removeEventListener('blur', cancelPress);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('click', handleClickCapture, true);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      clearTimer(spaceLongPressTimer);
      clearTimer(mouseLongPressTimer);
      clearTimer(touchLongPressTimer);
    },
  };
}
