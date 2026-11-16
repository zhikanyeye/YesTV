/**
 * 视频源账号同步：登录后把自定义源同步到账号，未登录仅存本地。
 * 拉取时按 ID 合并，保留本地已有顺序，避免覆盖用户本地调整。
 */

import type { VideoSource } from '@/lib/types';

const CUSTOM_SOURCE_PREFIX = 'source_';

/** 判断是否为用户自定义源（默认源 ID 不带 source_ 前缀） */
export function isCustomSource(source: VideoSource): boolean {
    return source.id.startsWith(CUSTOM_SOURCE_PREFIX);
}

/** 合并远端与本地源：同 ID 以本地为准，远端独有项追加到末尾 */
export function mergeRemoteSources(local: VideoSource[], remote: VideoSource[]): VideoSource[] {
    const seen = new Set(local.map((source) => source.id));
    const merged = [...local];
    for (const source of remote) {
        if (!seen.has(source.id)) {
            merged.push(source);
            seen.add(source.id);
        }
    }
    return merged;
}

/** 登录时拉取账号中的自定义源 */
export async function fetchRemoteSources(): Promise<VideoSource[] | null> {
    try {
        const response = await fetch('/api/sources');
        if (!response.ok) return null;
        const data = await response.json();
        return Array.isArray(data?.sources) ? data.sources : null;
    } catch {
        return null;
    }
}

/** 登录时把自定义源推送到账号，失败静默回退本地 */
export async function pushRemoteSources(sources: VideoSource[]): Promise<boolean> {
    try {
        const customSources = sources.filter(isCustomSource);
        const response = await fetch('/api/sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sources: customSources }),
        });
        return response.ok;
    } catch {
        return false;
    }
}
