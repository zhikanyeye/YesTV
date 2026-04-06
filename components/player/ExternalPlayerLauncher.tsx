'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ModalBackdrop } from '@/components/ui/ModalBackdrop';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Icons } from '@/components/ui/Icon';

type Platform = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'unknown';

interface PlayerOption {
  id: string;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  platform?: Platform[];
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  const maxTouchPoints = (navigator as any).maxTouchPoints || 0;
  const iPadOsDesktopUa = navigator.platform === 'MacIntel' && maxTouchPoints > 1;

  if (iPadOsDesktopUa || /iPad|iPhone|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows NT/i.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos';
  if (/Linux/i.test(ua)) return 'linux';
  return 'unknown';
}

function buildNPlayerLink(url: string): string {
  return url.replace(/^https?:\/\//i, (m) => `nplayer-${m.toLowerCase()}`);
}

function buildVlcIosLink(url: string): string {
  return `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(url)}`;
}

function buildInfuseLink(url: string): string {
  return `infuse://x-callback-url/play?url=${encodeURIComponent(url)}`;
}

function buildIinaLink(url: string): string {
  return `iina://weblink?url=${encodeURIComponent(url)}`;
}

function buildVlcDesktopLink(url: string): string {
  return `vlc://${url}`;
}

function buildPotPlayerLink(url: string): string {
  return `potplayer://${url}`;
}

function buildAndroidIntent(packageName: string, url: string): string {
  return `intent:${url}#Intent;package=${packageName};end`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ExternalPlayerLauncher({ url, title }: { url: string; title?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);

  const platform = useMemo(() => detectPlatform(), []);

  const proxyUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/api/proxy?url=${encodeURIComponent(url)}`;
  }, [url]);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        window.clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  const setStatusWithTimeout = (message: string) => {
    setStatus(message);
    if (statusTimeoutRef.current) {
      window.clearTimeout(statusTimeoutRef.current);
    }
    statusTimeoutRef.current = window.setTimeout(() => setStatus(null), 2000);
  };

  const openHref = (href: string) => {
    window.location.href = href;
  };

  const options = useMemo<PlayerOption[]>(() => {
    const base: PlayerOption[] = [
      {
        id: 'open-original',
        label: '用浏览器打开原链接',
        description: '在当前设备用浏览器或系统默认方式打开',
        onClick: () => window.open(url, '_blank', 'noopener,noreferrer'),
      },
      {
        id: 'copy-original',
        label: '复制原链接',
        onClick: async () => {
          const ok = await copyToClipboard(url);
          setStatusWithTimeout(ok ? '已复制原链接' : '复制失败');
        },
      },
    ];

    if (proxyUrl) {
      base.push({
        id: 'copy-proxy',
        label: '复制代理链接',
        description: '适合在本应用域名可访问时使用（例如同设备本地服务）',
        onClick: async () => {
          const ok = await copyToClipboard(proxyUrl);
          setStatusWithTimeout(ok ? '已复制代理链接' : '复制失败');
        },
      });
    }

    const players: PlayerOption[] = [
      {
        id: 'nplayer',
        label: 'nPlayer',
        description: 'iOS 常用播放器',
        href: buildNPlayerLink(url),
        platform: ['ios'],
      },
      {
        id: 'vlc-ios',
        label: 'VLC',
        description: 'iOS / iPadOS',
        href: buildVlcIosLink(url),
        platform: ['ios'],
      },
      {
        id: 'infuse',
        label: 'Infuse',
        description: 'iOS / iPadOS',
        href: buildInfuseLink(url),
        platform: ['ios'],
      },
      {
        id: 'vlc-android',
        label: 'VLC',
        description: 'Android',
        href: buildAndroidIntent('org.videolan.vlc', url),
        platform: ['android'],
      },
      {
        id: 'mxplayer-android',
        label: 'MX Player',
        description: 'Android',
        href: buildAndroidIntent('com.mxtech.videoplayer.ad', url),
        platform: ['android'],
      },
      {
        id: 'iina',
        label: 'IINA',
        description: 'macOS',
        href: buildIinaLink(url),
        platform: ['macos'],
      },
      {
        id: 'vlc-desktop',
        label: 'VLC',
        description: '桌面端',
        href: buildVlcDesktopLink(url),
        platform: ['macos', 'windows', 'linux'],
      },
      {
        id: 'potplayer',
        label: 'PotPlayer',
        description: 'Windows',
        href: buildPotPlayerLink(url),
        platform: ['windows'],
      },
    ];

    const filteredPlayers = players.filter((p) => {
      if (!p.platform) return true;
      return p.platform.includes(platform);
    });

    return [...base, ...filteredPlayers];
  }, [platform, proxyUrl, url]);

  if (!url) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => setIsOpen(true)}>
          <span className="flex items-center gap-2">
            <Icons.Globe size={18} />
            外部播放器
          </span>
        </Button>
        <span className="text-sm text-[var(--text-color-secondary)]">
          将当前播放链接交给其他播放器打开
        </span>
      </div>

      <ModalBackdrop isOpen={isOpen} onClose={() => setIsOpen(false)} />
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed top-1/2 left-1/2 z-[9999] w-[92%] max-w-lg -translate-x-1/2 -translate-y-1/2"
        >
          <Card hover={false} className="p-6">
            <ModalHeader title={title ? `外部播放器：${title}` : '外部播放器'} onClose={() => setIsOpen(false)} />

            {status && (
              <div className="mb-4 px-4 py-2 rounded-[var(--radius-2xl)] bg-[color-mix(in_srgb,var(--accent-color)_12%,transparent)] text-sm text-[var(--text-color)] flex items-center gap-2">
                <Icons.Check size={18} className="text-[var(--accent-color)]" />
                <span>{status}</span>
              </div>
            )}

            <div className="space-y-2">
              {options.map((opt) => {
                const onClick = opt.onClick
                  ? opt.onClick
                  : opt.href
                    ? () => openHref(opt.href!)
                    : undefined;

                return (
                  <button
                    key={opt.id}
                    onClick={onClick}
                    className="w-full text-left px-4 py-3 rounded-[var(--radius-2xl)] bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] transition-colors cursor-pointer"
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[var(--text-color)] font-medium">{opt.label}</div>
                        {opt.description && (
                          <div className="text-[var(--text-color-secondary)] text-xs mt-1">{opt.description}</div>
                        )}
                      </div>
                      <Icons.Link size={18} className="text-[var(--text-color-secondary)] flex-shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end">
              <Button variant="ghost" onClick={() => setIsOpen(false)}>
                关闭
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
