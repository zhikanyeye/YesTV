'use client';

import { SettingsSection } from './SettingsSection';
import { Icons } from '@/components/ui/Icon';

export function AboutSection() {
  return (
    <SettingsSection
      title="关于项目"
      icon={<Icons.Info size={24} />}
    >
      <div className="space-y-4 text-[var(--text-color-secondary)]">
        <p>
          YesTV 是一个开源的在线视频聚合应用，旨在为您提供一站式的观影体验。
        </p>
        <p>
          我们整合了多个视频源，让您可以轻松发现和观看来自不同平台的精彩内容。无论您喜欢电影、电视剧、综艺还是动漫，YesTV 都能满足您的需求。
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/zhikanyeye/YesTV"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[var(--text-color)] hover:text-[var(--accent-color)] transition-colors"
          >
            <Icons.Github size={20} />
            <span>GitHub 仓库</span>
          </a>
        </div>
      </div>
    </SettingsSection>
  );
}
