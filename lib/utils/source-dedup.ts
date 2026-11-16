import type { VideoSource } from '@/lib/types';

/** 归一化接口地址：忽略末尾斜杠，用于判断两个源是否指向同一接口 */
export function sourceEndpoint(source: VideoSource): string {
    return `${source.baseUrl.replace(/\/+$/, '')}${source.searchPath || ''}`;
}

/**
 * 查找与目标源重复的已有源：
 * 优先按接口地址判断，其次回退到 ID；编辑自身时不算重复。
 */
export function findDuplicateSource(
    target: VideoSource,
    existing: VideoSource[],
    editingId?: string
): VideoSource | undefined {
    const targetEndpoint = sourceEndpoint(target);
    return existing.find((source) => {
        if (editingId && source.id === editingId) return false;
        return source.id === target.id || sourceEndpoint(source) === targetEndpoint;
    });
}
