/**
 * hls.js custom loader that applies ad filtering to m3u8 playlists in direct mode.
 * Only filters media playlists (those containing #EXTINF), not master playlists.
 */

import Hls from 'hls.js';
import { filterM3u8Ads } from './m3u8-ad-filter';

export interface AdFilterLoaderConfig {
    /** Base URL of the original m3u8 request, for resolving relative URIs in the playlist. */
    baseUrl: string;
    /** Whether ad filtering is enabled. */
    enabled: boolean;
}

interface LoadContext {
    type: string;
    url: string;
}

interface LoadStats {
    loading: { start: number };
    loaded?: number;
}

interface LoadCallbacks {
    onSuccess: (response: { data: string | ArrayBuffer }, stats: LoadStats, context: LoadContext, networkDetails: unknown) => void;
    onError: (error: { code: number; text: string }, context: LoadContext, networkDetails: unknown) => void;
    onTimeout: (stats: LoadStats, context: LoadContext, networkDetails: unknown) => void;
}

export class AdFilterLoader extends Hls.DefaultConfig.loader {
    private config: AdFilterLoaderConfig;

    constructor(config: AdFilterLoaderConfig) {
        super(Hls.DefaultConfig);
        this.config = config;
    }

    load(
        context: LoadContext,
        config: typeof Hls.DefaultConfig,
        callbacks: LoadCallbacks
    ): void {
        const { onSuccess, onError, onTimeout } = callbacks;

        // Only intercept manifest (m3u8) requests when ad filtering is enabled
        const isManifest = context.type === 'manifest' || context.url.includes('.m3u8');
        const shouldFilter = this.config.enabled && isManifest;

        if (!shouldFilter) {
            // Pass through to default loader for non-manifest requests or when disabled
            super.load(context, config, callbacks);
            return;
        }

        // Wrap onSuccess to apply ad filtering
        const wrappedOnSuccess = (response: { data: string | ArrayBuffer }, stats: LoadStats, networkContext: LoadContext, networkDetails: unknown) => {
            try {
                let text = response.data;
                if (typeof text !== 'string') {
                    const decoder = new TextDecoder('utf-8');
                    text = decoder.decode(new Uint8Array(response.data as ArrayBuffer));
                }

                // Only filter media playlists (containing #EXTINF), not master playlists
                if (text.includes('#EXTINF') && !text.includes('#EXT-X-STREAM-INF')) {
                    const baseUrl = this.config.baseUrl || context.url;
                    const filtered = filterM3u8Ads(text, baseUrl);
                    response.data = filtered;
                }

                onSuccess(response, stats, networkContext, networkDetails);
            } catch (err) {
                console.warn('[AdFilterLoader] Failed to filter m3u8:', err);
                // On error, pass through the original response
                onSuccess(response, stats, networkContext, networkDetails);
            }
        };

        super.load(context, config, {
            onSuccess: wrappedOnSuccess,
            onError,
            onTimeout,
        });
    }
}
