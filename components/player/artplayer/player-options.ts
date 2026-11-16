/**
 * 播放器初始化选项推导：集中移动端/桌面端的能力差异，便于测试与复用。
 */

export interface PlayerCapabilityOptions {
  pip: boolean;
  fullscreen: boolean;
  fullscreenWeb: boolean;
  lock: boolean;
  gesture: boolean;
  showSpeedBoostButton: boolean;
}

/**
 * 移动端控制条宽度有限，只保留一个全屏入口（原生全屏）并隐藏 PiP；
 * 桌面端保留画中画与网页/原生双全屏，并显示控制条“长按加速”按钮。
 */
export function resolveCapabilityOptions(isMobile: boolean): PlayerCapabilityOptions {
  return {
    pip: !isMobile,
    fullscreen: true,
    fullscreenWeb: !isMobile,
    lock: isMobile,
    gesture: !isMobile,
    showSpeedBoostButton: !isMobile,
  };
}
