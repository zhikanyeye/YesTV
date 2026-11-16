/**
 * Source Import Utilities - Handle parsing and importing sources from various formats
 */

import type { VideoSource, SourceSubscription } from '@/lib/types';
import { normalizeVideoSource } from './source-normalization';

/**
 * Simplified source format for import
 */
export interface ImportSourceFormat {
    id: string;
    name: string;
    baseUrl: string;
    group?: 'normal' | 'premium';
    enabled?: boolean;
    priority?: number;
}

/**
 * Import result containing categorized sources
 */
export interface ImportResult {
    normalSources: VideoSource[];
    premiumSources: VideoSource[];
    totalCount: number;
}

/**
 * Convert simplified import format to full VideoSource
 */
export function convertToVideoSource(source: ImportSourceFormat): VideoSource {
    return normalizeVideoSource(source);
}

/**
 * Validate if an object is a valid source format
 */
export function isValidSourceFormat(obj: unknown): obj is ImportSourceFormat {
    if (typeof obj !== 'object' || obj === null) return false;
    const source = obj as Record<string, unknown>;
    return (
        typeof source.id === 'string' &&
        typeof source.name === 'string' &&
        typeof source.baseUrl === 'string' &&
        source.id.length > 0 &&
        source.name.length > 0 &&
        source.baseUrl.length > 0
    );
}

/**
 * Parse sources from JSON string
 * Supports both array format and wrapped object format
 */
export function parseSourcesFromJson(jsonString: string): ImportResult {
    const data = JSON.parse(jsonString);

    let sourcesArray: unknown[];

    // Handle different JSON structures
    if (Array.isArray(data)) {
        sourcesArray = data;
    } else if (data && Array.isArray(data.sources)) {
        sourcesArray = data.sources;
    } else if (data && Array.isArray(data.list)) {
        sourcesArray = data.list;
    } else if (data && Array.isArray(data.sites)) {
        sourcesArray = data.sites;
    } else if (data && typeof data.api_site === 'object' && data.api_site !== null) {
        sourcesArray = Object.entries(data.api_site).map(([id, item]) => ({
            ...(typeof item === 'object' && item !== null ? item : {}), id,
        }));
    } else if (typeof data === 'string' || (data && (data.baseUrl || data.url || data.api))) {
        sourcesArray = [data];
    } else {
        throw new Error('无法识别的JSON格式');
    }

    const normalSources: VideoSource[] = [];
    const premiumSources: VideoSource[] = [];

    for (const item of sourcesArray) {
        let source: VideoSource;
        try {
            source = normalizeVideoSource(item);
        } catch {
            continue;
        }
        if (source.group === 'premium') {
            premiumSources.push(source);
        } else {
            normalSources.push(source);
        }
    }

    if (normalSources.length + premiumSources.length === 0) {
        throw new Error('JSON 中没有有效的视频源地址，请检查 baseUrl、url 或 api 字段');
    }

    return {
        normalSources,
        premiumSources,
        totalCount: normalSources.length + premiumSources.length,
    };
}

/**
 * Fetch and parse sources from a URL
 */
export async function fetchSourcesFromUrl(url: string): Promise<ImportResult> {
    // If we're in the browser and it's an external URL, use our proxy to avoid CORS issues
    const isExternal = url.startsWith('http') && (typeof window !== 'undefined' && !url.includes(window.location.host));
    const fetchUrl = isExternal
        ? `/api/proxy?url=${encodeURIComponent(url)}`
        : url;

    const response = await fetch(fetchUrl, {
        headers: {
            'Accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`获取失败: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    return parseSourcesFromJson(text);
}

/**
 * Create a new subscription object
 */
export function createSubscription(name: string, url: string): SourceSubscription {
    return {
        id: `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name: name.trim() || '未命名订阅',
        url: url.trim(),
        lastUpdated: 0,
        autoRefresh: true,
    };
}

/**
 * Merge new sources with existing sources, avoiding duplicates
 */
export function mergeSources(
    existing: VideoSource[],
    newSources: VideoSource[]
): VideoSource[] {
    const existingIds = new Set(existing.map(s => s.id));
    const merged = [...existing];

    for (const source of newSources) {
        if (existingIds.has(source.id)) {
            // Update existing source
            const idx = merged.findIndex(s => s.id === source.id);
            if (idx !== -1) {
                merged[idx] = { ...merged[idx], ...source };
            }
        } else {
            // Add new source
            merged.push({
                ...source,
                priority: merged.length + 1,
            });
            existingIds.add(source.id);
        }
    }

    return merged;
}
