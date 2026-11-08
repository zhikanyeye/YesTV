/**
 * hls.js custom loader that applies ad filtering to m3u8 playlists in direct mode.
 * Only filters media playlists (those containing #EXTINF), not master playlists.
 */

import Hls from 'hls.js';
import type {
    HlsConfig,
    Loader,
    LoaderCallbacks,
    LoaderConfiguration,
    LoaderContext,
    LoaderStats,
} from 'hls.js';
import { filterM3u8Ads } from './m3u8-ad-filter';

const DefaultLoader = Hls.DefaultConfig.loader;

export class AdFilterLoader implements Loader<LoaderContext> {
    private inner: Loader<LoaderContext>;

    constructor(config: HlsConfig) {
        this.inner = new DefaultLoader(config);
    }

    destroy(): void {
        this.inner.destroy();
    }

    abort(): void {
        this.inner.abort();
    }

    getCacheAge(): number | null {
        return this.inner.getCacheAge ? this.inner.getCacheAge() : null;
    }

    getResponseHeader(name: string): string | null {
        return this.inner.getResponseHeader ? this.inner.getResponseHeader(name) : null;
    }

    get context(): LoaderContext | null {
        return this.inner.context;
    }

    set context(ctx: LoaderContext | null) {
        this.inner.context = ctx;
    }

    get stats(): LoaderStats {
        return this.inner.stats;
    }

    set stats(s: LoaderStats) {
        this.inner.stats = s;
    }

    load(
        context: LoaderContext,
        config: LoaderConfiguration,
        callbacks: LoaderCallbacks<LoaderContext>
    ): void {
        const isManifest =
            context.responseType === 'text' ||
            context.responseType === '' ||
            context.url.includes('.m3u8');

        if (!isManifest) {
            this.inner.load(context, config, callbacks);
            return;
        }

        const wrappedCallbacks: LoaderCallbacks<LoaderContext> = {
            ...callbacks,
            onSuccess: (response, stats, ctx, networkDetails) => {
                try {
                    const raw = response.data;
                    const text =
                        typeof raw === 'string'
                            ? raw
                            : new TextDecoder('utf-8').decode(new Uint8Array(raw as ArrayBuffer));

                    if (text.includes('#EXTINF') && !text.includes('#EXT-X-STREAM-INF')) {
                        const filtered = filterM3u8Ads(text, ctx.url);
                        response.data = filtered;
                    }
                    callbacks.onSuccess(response, stats, ctx, networkDetails);
                } catch (err) {
                    console.warn('[AdFilterLoader] Failed to filter m3u8:', err);
                    callbacks.onSuccess(response, stats, ctx, networkDetails);
                }
            },
        };

        this.inner.load(context, config, wrappedCallbacks);
    }
}
