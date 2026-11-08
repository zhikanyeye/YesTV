/**
 * Heuristic ad remover for HLS VOD playlists.
 *
 * Video resource sites typically splice ads into the main stream as short
 * blocks separated by #EXT-X-DISCONTINUITY tags. Those blocks are served from
 * a different directory (or with a different file naming scheme) than the
 * main feature. We drop such blocks, with several safety nets so that a
 * wrong guess never destroys the real content:
 *
 * - only VOD playlists (#EXT-X-ENDLIST) with #EXTINF segments are touched
 * - the main content must clearly dominate the playlist
 * - an ad block must be short
 * - the total removed duration is capped; otherwise the playlist is untouched
 *
 * Encryption (#EXT-X-KEY) and init segment (#EXT-X-MAP) tags are always kept
 * so that removing a block can never break decryption of the remaining ones.
 */

const MAX_AD_BLOCK_SECONDS = 120;
const MAX_NAME_PATTERN_AD_SECONDS = 60;
const MAIN_SHARE_MIN = 0.6;
const MAX_REMOVED_RATIO = 0.35;

const AD_KEYWORD_RE = /(^|[/_.\-=])(ads?|advert(ise(ment)?)?|adv|preroll|midroll|guanggao|commercial)([/_.\-=0-9]|$)/i;

interface Segment {
    /** Tag lines that belong to this segment only (EXTINF, BYTERANGE, ...). */
    ownTags: string[];
    /** Tags that must survive even when the segment is dropped (KEY, MAP). */
    keepTags: string[];
    uri: string;
    duration: number;
    dirKey: string;
    namePattern: string;
}

interface Block {
    /** True when an #EXT-X-DISCONTINUITY tag opened this block. */
    startsWithDiscontinuity: boolean;
    segments: Segment[];
    duration: number;
}

function parseDuration(line: string): number {
    const match = line.match(/^#EXTINF:\s*([\d.]+)/i);
    const value = match ? parseFloat(match[1]) : 0;
    return Number.isFinite(value) ? value : 0;
}

function describeUri(uri: string, baseUrl?: string): { dirKey: string; namePattern: string } {
    let pathname = uri;
    let host = '';
    try {
        const resolved = new URL(uri, baseUrl || 'http://placeholder.invalid/');
        pathname = resolved.pathname;
        host = resolved.host;
    } catch {
        // keep raw uri
    }
    const slash = pathname.lastIndexOf('/');
    const dir = slash >= 0 ? pathname.slice(0, slash + 1) : '';
    const base = slash >= 0 ? pathname.slice(slash + 1) : pathname;
    const namePattern = base
        .replace(/[0-9a-f]{8,}/gi, 'H')
        .replace(/\d+/g, '#');
    return { dirKey: `${host}${dir}`, namePattern };
}

function dominantKey(items: Array<{ key: string; weight: number }>): { key: string; share: number } | null {
    const totals = new Map<string, number>();
    let sum = 0;
    for (const { key, weight } of items) {
        totals.set(key, (totals.get(key) || 0) + weight);
        sum += weight;
    }
    if (sum <= 0) return null;
    let best = '';
    let bestWeight = -1;
    for (const [key, weight] of totals) {
        if (weight > bestWeight) {
            best = key;
            bestWeight = weight;
        }
    }
    return { key: best, share: bestWeight / sum };
}

/**
 * Remove ad blocks from a media playlist. Returns the input unchanged when
 * nothing is confidently identified as an ad.
 */
export function filterM3u8Ads(content: string, baseUrl?: string): string {
    if (!content.includes('#EXTINF') || content.includes('#EXT-X-STREAM-INF')) return content;
    // Live playlists slide, so dominance heuristics do not apply.
    if (!content.includes('#EXT-X-ENDLIST')) return content;

    const lines = content.split(/\r?\n/);

    const header: string[] = [];
    const blocks: Block[] = [];
    const trailer: string[] = [];

    let current: Block | null = null;
    let pendingOwn: string[] = [];
    let pendingKeep: string[] = [];
    let pendingDuration = 0;
    let pendingDiscontinuity = false;
    let seenSegment = false;
    let ended = false;

    const openBlock = (discontinuity: boolean) => {
        const newBlock: Block = { startsWithDiscontinuity: discontinuity, segments: [], duration: 0 };
        current = newBlock;
        blocks.push(newBlock);
    };

    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        if (ended) {
            trailer.push(line);
            continue;
        }

        if (line.startsWith('#EXT-X-ENDLIST')) {
            ended = true;
            trailer.push(line);
            continue;
        }

        if (line.startsWith('#EXT-X-DISCONTINUITY') && !line.startsWith('#EXT-X-DISCONTINUITY-SEQUENCE')) {
            pendingDiscontinuity = true;
            continue;
        }

        if (line.startsWith('#')) {
            if (!seenSegment && !line.startsWith('#EXTINF')) {
                // Playlist level header tags before the first segment.
                if (!line.startsWith('#EXT-X-KEY') && !line.startsWith('#EXT-X-MAP')) {
                    header.push(line);
                    continue;
                }
            }
            if (line.startsWith('#EXT-X-KEY') || line.startsWith('#EXT-X-MAP')) {
                pendingKeep.push(line);
            } else {
                pendingOwn.push(line);
                if (line.startsWith('#EXTINF')) pendingDuration = parseDuration(line);
            }
            continue;
        }

        // Segment URI line
        if (!current || pendingDiscontinuity) {
            openBlock(pendingDiscontinuity);
            pendingDiscontinuity = false;
        }
        // At this point current must be defined because openBlock was just called
        const { dirKey, namePattern } = describeUri(line, baseUrl);
        const segment: Segment = {
            ownTags: pendingOwn,
            keepTags: pendingKeep,
            uri: line,
            duration: pendingDuration,
            dirKey,
            namePattern,
        };
        current!.segments.push(segment);
        current!.duration += pendingDuration;
        pendingOwn = [];
        pendingKeep = [];
        pendingDuration = 0;
        seenSegment = true;
    }

    if (blocks.length < 2) return content;

    const allSegments = blocks.flatMap((block) => block.segments);
    const totalDuration = blocks.reduce((sum, block) => sum + block.duration, 0);
    if (totalDuration <= 0) return content;

    const mainDir = dominantKey(allSegments.map((s) => ({ key: s.dirKey, weight: s.duration || 1 })));
    const mainName = dominantKey(allSegments.map((s) => ({ key: s.namePattern, weight: s.duration || 1 })));
    if (!mainDir || mainDir.share < MAIN_SHARE_MIN) return content;

    const isAdBlock = (block: Block, index: number): boolean => {
        if (block.segments.length === 0) return false;
        // The first block has no discontinuity before it; ads can still be
        // there (pre-roll) but only when the block clearly differs.
        if (index > 0 && !block.startsWithDiscontinuity) return false;
        if (block.duration > MAX_AD_BLOCK_SECONDS) return false;

        const blockDir = dominantKey(block.segments.map((s) => ({ key: s.dirKey, weight: s.duration || 1 })));
        if (blockDir && blockDir.key !== mainDir.key) return true;

        if (block.segments.some((s) => AD_KEYWORD_RE.test(s.uri))) return true;

        if (mainName && mainName.share >= 0.7 && block.duration <= MAX_NAME_PATTERN_AD_SECONDS) {
            const blockName = dominantKey(block.segments.map((s) => ({ key: s.namePattern, weight: s.duration || 1 })));
            if (blockName && blockName.key !== mainName.key) return true;
        }
        return false;
    };

    const adFlags = blocks.map(isAdBlock);
    const removedDuration = blocks.reduce((sum, block, i) => sum + (adFlags[i] ? block.duration : 0), 0);
    if (removedDuration <= 0) return content;
    if (removedDuration / totalDuration > MAX_REMOVED_RATIO) return content;
    if (adFlags.every(Boolean)) return content;

    const out: string[] = [...header];
    let emittedAny = false;
    blocks.forEach((block, i) => {
        if (adFlags[i]) {
            // Keep key / init-segment declarations so later blocks still decrypt.
            for (const segment of block.segments) out.push(...segment.keepTags);
            return;
        }
        if (block.startsWithDiscontinuity && emittedAny) out.push('#EXT-X-DISCONTINUITY');
        for (const segment of block.segments) {
            out.push(...segment.keepTags, ...segment.ownTags, segment.uri);
        }
        emittedAny = true;
    });
    out.push(...trailer);
    return out.join('\n') + '\n';
}
