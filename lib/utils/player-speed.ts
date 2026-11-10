/**
 * 播放器长按加速相关的共享常量。
 * 统一倍速范围与默认值，避免设置面板、持久化和播放逻辑各自硬编码。
 */

/** 长按加速倍速下限 */
export const LONG_PRESS_SPEED_MIN = 0.25;

/** 长按加速倍速上限 */
export const LONG_PRESS_SPEED_MAX = 8;

/** 长按加速默认倍速 */
export const LONG_PRESS_SPEED_DEFAULT = 2;

/** 长按加速滑块步进 */
export const LONG_PRESS_SPEED_STEP = 0.25;

/**
 * 将任意输入规整为合法的长按加速倍速：
 * 非数字回退到默认值，超出范围则收敛到边界。
 */
export function normalizeLongPressSpeed(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return LONG_PRESS_SPEED_DEFAULT;
  return Math.min(LONG_PRESS_SPEED_MAX, Math.max(LONG_PRESS_SPEED_MIN, num));
}
