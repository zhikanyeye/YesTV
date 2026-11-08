import { filterM3u8Ads } from './m3u8-ad-filter';

/**
 * Extract and proxy URI from HLS tags like EXT-X-KEY, EXT-X-MAP, EXT-X-MEDIA
 */
function buildProxyUrl(origin: string, absoluteUrl: string, adFilter: boolean): string {
    return `${origin}/api/proxy?url=${encodeURIComponent(absoluteUrl)}${adFilter ? '&ad=1' : ''}`;
}

function proxyUriInTag(line: string, base: URL, origin: string, adFilter: boolean): string {
    const uriMatch = line.match(/URI="([^"]+)"/);
    if (uriMatch && uriMatch[1]) {
        const uri = uriMatch[1];
        // Skip if already proxied
        if (uri.includes('/api/proxy')) {
            return line;
        }
        try {
            const absoluteUrl = new URL(uri, base).toString();
            const proxiedUrl = buildProxyUrl(origin, absoluteUrl, adFilter);
            return line.replace(/URI="[^"]+"/, `URI="${proxiedUrl}"`);
        } catch {
            return line;
        }
    }
    return line;
}

export interface ProcessM3u8Options {
    /** Strip ad blocks from media playlists before rewriting URLs. */
    adFilter?: boolean;
}

export async function processM3u8Content(
    content: string,
    baseUrl: string,
    origin: string,
    options: ProcessM3u8Options = {}
): Promise<string> {
    const adFilter = options.adFilter === true;
    // Filter on the original absolute URLs: once segment URLs are rewritten to
    // /api/proxy?url=... their directories can no longer be compared.
    const source = adFilter ? filterM3u8Ads(content, baseUrl) : content;
    const lines = source.split('\n');
    const base = new URL(baseUrl);

    const processedLines = lines.map(line => {
        const trimmed = line.trim();

        // Handle EXT-X-KEY (encryption keys)
        if (trimmed.startsWith('#EXT-X-KEY:')) {
            return proxyUriInTag(trimmed, base, origin, adFilter);
        }

        // Handle EXT-X-MAP (fMP4 initialization segments)
        if (trimmed.startsWith('#EXT-X-MAP:')) {
            return proxyUriInTag(trimmed, base, origin, adFilter);
        }

        // Handle EXT-X-MEDIA (alternative audio/subtitle tracks)
        if (trimmed.startsWith('#EXT-X-MEDIA:')) {
            return proxyUriInTag(trimmed, base, origin, adFilter);
        }

        // Handle EXT-X-STREAM-INF (master playlist variants)
        // The URL is on the NEXT line after this tag
        if (trimmed.startsWith('#EXT-X-STREAM-INF:')) {
            return line;
        }

        // Skip other comments and empty lines
        if (trimmed.startsWith('#') || !trimmed) {
            return line;
        }

        // Resolve relative URLs for segments and variant playlists
        // Skip if already proxied
        if (trimmed.includes('/api/proxy')) {
            return line;
        }

        try {
            const absoluteUrl = new URL(trimmed, base).toString();
            return buildProxyUrl(origin, absoluteUrl, adFilter);
        } catch {
            return line;
        }
    });

    return processedLines.join('\n');
}
