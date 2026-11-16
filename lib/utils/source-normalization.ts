import type { VideoSource } from '@/lib/types';

/** Normalize known MacCMS URL forms without making network requests. */
export function normalizeSourceUrl(input: string): URL {
    const value = input.trim();
    if (!value) throw new Error('请填写视频源地址');
    const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value) && !/^[^/?#]+:\d+(?:[/?#]|$)/.test(value);
    const url = new URL(value.startsWith('//') ? `https:${value}` :
        hasScheme ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('请输入 HTTP 或 HTTPS 视频源地址');
    }
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') {
        throw new Error('请输入完整的视频源域名');
    }
    url.hash = '';
    let path = url.pathname.replace(/\/+$/, '');
    if (!path) path = '/api.php/provide/vod';
    else if (/\/api\.php$/i.test(path)) path += '/provide/vod';
    else if (/\/api\.php\/provide$/i.test(path)) path += '/vod';
    else if (/\/api\.php\/provide\/json$/i.test(path)) {
        path = path.replace(/\/json$/i, '/vod');
    }
    path = path.replace(/\/at\/xml(?=\/|$)/i, '/at/json');
    url.pathname = /\/api\.php\/provide\/vod$/i.test(path) || url.pathname.endsWith('/')
        ? `${path}/` : path;
    for (const key of ['ac', 'wd', 'ids', 'pg']) url.searchParams.delete(key);
    if (url.searchParams.get('at')?.toLowerCase() === 'xml') url.searchParams.set('at', 'json');
    return url;
}

/** All import and form inputs produce the same persisted VideoSource shape. */
export function normalizeVideoSource(input: unknown): VideoSource {
    const source = typeof input === 'string' ? { url: input } : input;
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        throw new Error('视频源应为地址或 JSON 配置对象');
    }
    const data = source as Record<string, unknown>;
    const address = [data.baseUrl, data.url, data.api].find(
        (value): value is string => typeof value === 'string' && value.trim().length > 0
    );
    if (!address) throw new Error('JSON 配置需要 baseUrl、url 或 api 地址');
    const endpoint = normalizeSourceUrl(address);
    const resolvePath = (path: unknown) => {
        const baseAddress = address.trim().split(/[?#]/)[0].replace(/\/+$/, '');
        const resolved = typeof path === 'string' && path.trim()
            ? normalizeSourceUrl(/^https?:\/\//i.test(path) ? path :
                `${baseAddress}${path.startsWith('?') ? '' : '/'}${path.replace(/^\/+/, '')}`)
            : endpoint;
        if (resolved.origin !== endpoint.origin) throw new Error('搜索和详情接口应使用同一源站');
        for (const [key, value] of endpoint.searchParams) {
            if (!resolved.searchParams.has(key)) resolved.searchParams.append(key, value);
        }
        return resolved.pathname + resolved.search;
    };
    const searchPath = resolvePath(data.searchPath);
    const detailPath = resolvePath(data.detailPath);
    // Stable URL-based IDs support Chinese names and repeated imports.
    let hash = 2166136261;
    for (const char of endpoint.origin + searchPath + detailPath) {
        hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    }
    const id = typeof data.id === 'string' || typeof data.id === 'number'
        ? String(data.id).trim() : '';
    const headers = data.headers && typeof data.headers === 'object' && !Array.isArray(data.headers)
        ? Object.fromEntries(Object.entries(data.headers).filter((entry): entry is [string, string] =>
            typeof entry[1] === 'string')) : undefined;
    return {
        id: id || `source_${(hash >>> 0).toString(36)}`,
        name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : endpoint.hostname,
        baseUrl: endpoint.origin,
        searchPath,
        detailPath,
        enabled: data.enabled !== false,
        priority: typeof data.priority === 'number' && Number.isFinite(data.priority) ? data.priority : 1,
        group: data.group === 'premium' ? 'premium' : 'normal',
        ...(headers ? { headers } : {}),
    };
}
