import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface UseHlsPlayerProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    src: string;
    autoPlay?: boolean;
    onAutoPlayPrevented?: (error: Error) => void;
    onError?: (message: string) => void;
}

export function useHlsPlayer({
    videoRef,
    src,
    autoPlay = false,
    onAutoPlayPrevented,
    onError
}: UseHlsPlayerProps) {
    const hlsRef = useRef<Hls | null>(null);

    // Callbacks live in refs so that inline arrow functions passed by callers
    // never re-run the effect below (which would destroy and rebuild hls.js
    // on every parent re-render and make the video flicker).
    const onErrorRef = useRef(onError);
    const onAutoPlayPreventedRef = useRef(onAutoPlayPrevented);
    useEffect(() => {
        onErrorRef.current = onError;
        onAutoPlayPreventedRef.current = onAutoPlayPrevented;
    });

    useEffect(() => {
        const onError = (message: string) => onErrorRef.current?.(message);
        const onAutoPlayPrevented = (err: Error) => onAutoPlayPreventedRef.current?.(err);

        const video = videoRef.current;
        if (!video || !src) return;

        // Cleanup previous HLS instance
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        let hls: Hls | null = null;

        // Check if HLS is supported natively (Safari, Mobile Chrome)
        // We prefer native playback if available as it's usually more battery efficient
        const isNativeHlsSupported = video.canPlayType('application/vnd.apple.mpegurl');

        if (Hls.isSupported()) {
            // Use hls.js for browsers without native support (Desktop Chrome, Firefox, Edge)
            // OR if we want to force hls.js for better control (optional, but sticking to native first is safer)

            // Note: Some desktop browsers (like Safari) support native HLS.
            // We usually prefer native, BUT sometimes native implementation is buggy or lacks features.
            // For now, we follow the standard pattern: Native first, then HLS.js.
            // EXCEPT for Chrome on Desktop which reports canPlayType as '' (false).

            if (!isNativeHlsSupported) {
                hls = new Hls({
                    // Worker & Performance
                    enableWorker: true,
                    lowLatencyMode: false, // Disable low latency for more stable playback

                    // Buffer Settings - More aggressive buffering for smoother playback
                    maxBufferLength: 60,           // Buffer up to 60 seconds ahead
                    maxMaxBufferLength: 120,       // Allow up to 2 minutes of buffer
                    maxBufferSize: 60 * 1000 * 1000, // 60MB buffer size
                    maxBufferHole: 0.5,            // Allow small gaps in buffer

                    // Start with more buffer before playing
                    startFragPrefetch: true,       // Enable prefetching next fragment

                    // ABR (Adaptive Bitrate) Settings - Be more conservative
                    abrEwmaDefaultEstimate: 500000,     // Start with conservative bandwidth estimate (500kbps)
                    abrEwmaFastLive: 3,                 // Fast adaptation for live
                    abrEwmaSlowLive: 9,                 // Slow adaptation for live  
                    abrEwmaFastVoD: 3,                  // Fast adaptation for VoD
                    abrEwmaSlowVoD: 9,                  // Slow adaptation for VoD
                    abrBandWidthFactor: 0.8,            // Use 80% of estimated bandwidth (conservative)
                    abrBandWidthUpFactor: 0.7,          // Even more conservative when switching up

                    // Loading Settings - Fail fast: geo-blocked/anti-leech sources return 403
                    // and retrying them only stalls the player with a spinner
                    fragLoadingMaxRetry: 3,
                    fragLoadingRetryDelay: 500,
                    fragLoadingMaxRetryTimeout: 8000,
                    manifestLoadingMaxRetry: 2,
                    manifestLoadingRetryDelay: 500,
                    manifestLoadingMaxRetryTimeout: 4000,
                    levelLoadingMaxRetry: 2,
                    levelLoadingRetryDelay: 500,
                    levelLoadingMaxRetryTimeout: 4000,

                    // Timeouts
                    fragLoadingTimeOut: 15000,     // 15 seconds for fragment loading
                    manifestLoadingTimeOut: 8000, // 8 seconds for manifest
                    levelLoadingTimeOut: 8000,    // 8 seconds for level

                    // Backbuffer - Keep some played content for seeking back
                    backBufferLength: 30,          // Keep 30 seconds of played content
                });
                hlsRef.current = hls;

                hls.loadSource(src);
                hls.attachMedia(video);

                hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
                    // Force play if we have the first segment and it's not playing yet
                    // detailed: data.frag.sn is the sequence number
                    if (autoPlay && video.paused && data.frag.start === 0) {
                        video.play().catch(console.warn);
                    }
                });

                hls.on(Hls.Events.MANIFEST_PARSED, () => {

                    // Check for HEVC/H.265 codec (limited browser support)
                    if (hls) {
                        const levels = hls.levels;
                        if (levels && levels.length > 0) {
                            const hasHEVC = levels.some(level =>
                                level.videoCodec?.toLowerCase().includes('hev') ||
                                level.videoCodec?.toLowerCase().includes('h265')
                            );
                            if (hasHEVC) {
                                console.warn('[HLS] ⚠️ HEVC/H.265 codec detected - may not play in all browsers');
                                console.warn('[HLS] Supported: Safari with hardware acceleration, some Edge versions');
                                console.warn('[HLS] Not supported: Most Chrome/Firefox versions');
                                // Notify parent about potential codec issues
                                onError?.('检测到 HEVC/H.265 编码，当前浏览器可能不支持');
                            }
                        }
                    }

                    if (autoPlay) {
                        video.play().catch((err) => {
                            console.warn('[HLS] Autoplay prevented:', err);
                            onAutoPlayPrevented?.(err);
                        });
                    }
                });

                let networkErrorRetries = 0;
                let mediaErrorRetries = 0;
                const MAX_RETRIES = 2;

                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR: {
                                // Source explicitly refused (geo-block / anti-leech): retrying
                                // never succeeds, surface a clear error immediately
                                const status = data.response?.code;
                                if (status === 401 || status === 403 || status === 451) {
                                    console.error(`[HLS] Source refused access (HTTP ${status})`);
                                    onError?.('源站拒绝访问（地区限制或防盗链），请尝试换源播放');
                                    hls?.destroy();
                                    break;
                                }
                                networkErrorRetries++;
                                console.error(`[HLS] Network error (${networkErrorRetries}/${MAX_RETRIES}), trying to recover...`, data);
                                if (networkErrorRetries <= MAX_RETRIES) {
                                    hls?.startLoad();
                                } else {
                                    console.error('[HLS] Too many network errors, giving up');
                                    onError?.('网络错误：无法加载视频流');
                                    hls?.destroy();
                                }
                                break;
                            }
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                mediaErrorRetries++;
                                console.error(`[HLS] Media error (${mediaErrorRetries}/${MAX_RETRIES}), trying to recover...`, data);
                                if (mediaErrorRetries <= MAX_RETRIES) {
                                    hls?.recoverMediaError();
                                } else {
                                    console.error('[HLS] Too many media errors, giving up');
                                    onError?.('媒体错误：视频格式不支持或已损坏');
                                    hls?.destroy();
                                }
                                break;
                            default:
                                console.error('[HLS] Fatal error, cannot recover:', data);
                                onError?.(`致命错误：${data.details || '未知错误'}`);
                                hls?.destroy();
                                break;
                        }
                    } else {
                        // Non-fatal errors
                        console.warn('[HLS] Non-fatal error:', data.type, data.details);
                    }
                });
            } else {
                // Native HLS support
                video.src = src;
            }
        } else if (isNativeHlsSupported) {
            // Fallback for environments where Hls.js is not supported but native is (e.g. iOS without MSE?)
            video.src = src;
        } else {
            console.error('[HLS] HLS not supported in this browser');
            onError?.('当前浏览器不支持 HLS 视频播放');
        }

        return () => {
            if (hls) {
                hls.destroy();
            }
        };
    }, [src, videoRef, autoPlay]);
}
