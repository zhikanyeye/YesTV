import { NextRequest, NextResponse } from 'next/server';
import { processM3u8Content } from '@/lib/utils/proxy-utils';
import { fetchWithRetry } from '@/lib/utils/fetch-with-retry';


// Disable SSL verification for video sources with invalid certificates
// Note: This is not supported in Cloudflare Workers/Edge Runtime.
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

function normalizeHostname(hostname: string): string {
    return hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
}

function isIpv4Address(hostname: string): boolean {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(normalizeHostname(hostname));
}

function isPrivateIpv4(hostname: string): boolean {
    const normalized = normalizeHostname(hostname);
    if (!isIpv4Address(normalized)) return false;

    const octets = normalized.split('.').map(Number);
    const [first, second] = octets;

    if (octets.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
        return true;
    }

    return first === 0 ||
        first === 10 ||
        first === 127 ||
        (first === 169 && second === 254) ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168);
}

function isBlockedIpv6(hostname: string): boolean {
    const normalized = normalizeHostname(hostname);
    return normalized === '::1' ||
        normalized.startsWith('fe80:') ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd');
}

function isBlockedHostname(hostname: string): boolean {
    const normalized = normalizeHostname(hostname);
    return normalized === 'localhost' ||
        normalized.endsWith('.localhost') ||
        normalized.endsWith('.local');
}

function isProxyTargetAllowed(target: URL): boolean {
    if (!ALLOWED_PROTOCOLS.has(target.protocol)) {
        return false;
    }

    if (target.username || target.password) {
        return false;
    }

    if (isBlockedHostname(target.hostname) || isPrivateIpv4(target.hostname) || isBlockedIpv6(target.hostname)) {
        return false;
    }

    return true;
}

export async function GET(request: NextRequest) {
    const rawUrl = request.nextUrl.searchParams.get('url');

    if (!rawUrl) {
        return new NextResponse('Missing URL parameter', { status: 400 });
    }

    let targetUrl: URL;

    try {
        targetUrl = new URL(rawUrl);
    } catch {
        return new NextResponse('Invalid URL parameter', { status: 400 });
    }

    if (!isProxyTargetAllowed(targetUrl)) {
        return new NextResponse('Blocked proxy target', { status: 403 });
    }

    const url = targetUrl.toString();

    try {
        // Extract headers to forward (only essential ones)
        const requestHeaders: Record<string, string> = {};
        const forwardHeaders = ['range'];

        forwardHeaders.forEach(key => {
            const value = request.headers.get(key);
            if (value) requestHeaders[key] = value;
        });

        const response = await fetchWithRetry({ url, headers: requestHeaders });

        // If upstream returned an error, pass it through with CORS headers
        if (!response.ok) {
            const errorText = await response.text();
            return new NextResponse(errorText || `Upstream error: ${response.status}`, {
                status: response.status,
                statusText: response.statusText,
                headers: {
                    'Content-Type': response.headers.get('Content-Type') || 'text/plain',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        const contentType = response.headers.get('Content-Type');

        // Better M3U8 detection: check both content-type and actual content
        const isM3u8ByHeader = contentType &&
            (contentType.includes('application/vnd.apple.mpegurl') ||
                contentType.includes('application/x-mpegurl')) ||
            url.endsWith('.m3u8');

        // For potential M3U8 files, check content
        if (isM3u8ByHeader || url.includes('.m3u8')) {
            const text = await response.text();

            // Verify it's actually M3U8 content (starts with #EXTM3U or #EXT-X-)
            if (text.trim().startsWith('#EXTM3U') || text.trim().startsWith('#EXT-X-')) {
                const modifiedText = await processM3u8Content(text, url, request.nextUrl.origin);

                return new NextResponse(modifiedText, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: {
                        'Content-Type': 'application/vnd.apple.mpegurl',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    },
                });
            }

            // Not M3U8 content, return as-is
            return new NextResponse(text, {
                status: response.status,
                statusText: response.statusText,
                headers: {
                    'Content-Type': contentType || 'text/plain',
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }

        // For non-m3u8 content
        const headers = new Headers();
        response.headers.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
                headers.set(key, value);
            }
        });

        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

        return new NextResponse(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: headers,
        });
    } catch (error) {
        console.error('Proxy error:', error);
        return new NextResponse(
            JSON.stringify({
                error: 'Proxy request failed',
                message: error instanceof Error ? error.message : 'Unknown error',
                url: url
            }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                }
            }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}

