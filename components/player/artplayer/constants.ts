/**
 * ArtVideoPlayer 共享常量与存储键。
 * 集中管理，避免播放器初始化、设置面板、长按加速等模块各自硬编码。
 */

/** 记忆倍速的 localStorage 键 */
export const STORAGE_PLAYBACK_RATE_KEY = 'artplayer_playback_rate';

/** 记忆画面比例的 localStorage 键 */
export const STORAGE_ASPECT_RATIO_KEY = 'artplayer_aspect_ratio';

/** 视频长时间未开始播放的看门狗超时（毫秒） */
export const PLAYBACK_WATCHDOG_MS = 25000;

/** 长按判定为“长按加速”的阈值（毫秒） */
export const LONG_PRESS_THRESHOLD_MS = 350;

/** 空格键长按加速的判定阈值（毫秒） */
export const SPACE_LONG_PRESS_MS = 300;

/** 被 CSS 引用的长按加速按钮类名 */
export const SPEED_BOOST_BUTTON_CLASS = 'art-control-speedBoost';
