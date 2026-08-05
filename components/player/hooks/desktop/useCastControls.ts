'use client';

import { useCallback, useEffect, useRef, useMemo } from 'react';

interface CastContext {
    setOptions(options: { receiverApplicationId: string; autoJoinPolicy: string }): void;
    addEventListener(eventType: string, listener: (event: CastEvent) => void): void;
    getCastState(): string;
    getCurrentSession(): CastSession | null;
    requestSession(): void;
}

interface CastSession {
    loadMedia(request: CastLoadRequest): Promise<void>;
}

interface CastEvent {
    castState?: string;
    sessionState?: string;
}

interface CastMediaInfo {
    contentType: string;
}

interface CastLoadRequest {
    currentTime?: number;
}

interface CastFramework {
    CastContext: { getInstance(): CastContext };
    CastContextEventType: { CAST_STATE_CHANGED: string; SESSION_STATE_CHANGED: string };
    CastState: { NO_DEVICES_AVAILABLE: string };
    SessionState: { SESSION_STARTED: string; SESSION_RESUMED: string };
}

interface CastNamespace {
    framework: CastFramework;
}

interface ChromeCastNamespace {
    media: {
        DEFAULT_MEDIA_RECEIVER_APP_ID: string;
        MediaInfo: new (src: string, contentType: string) => CastMediaInfo;
        LoadRequest: new (mediaInfo: CastMediaInfo) => CastLoadRequest;
    };
    AutoJoinPolicy: { ORIGIN_SCOPED: string };
}

interface UseCastControlsProps {
    src: string;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    setIsCastAvailable: (available: boolean) => void;
    setIsCasting: (casting: boolean) => void;
}

declare global {
    interface Window {
        chrome: { cast: ChromeCastNamespace };
        cast?: CastNamespace;
        __onGCastApiAvailable?: (isAvailable: boolean) => void;
    }
}

export function useCastControls({
    src,
    videoRef,
    setIsCastAvailable,
    setIsCasting
}: UseCastControlsProps) {
    const castContextRef = useRef<CastContext | null>(null);

    const loadMedia = useCallback(() => {
        if (!castContextRef.current || !src) return;

        const castContext = castContextRef.current;
        const session = castContext.getCurrentSession();
        if (!session) return;

        const mediaInfo = new window.chrome.cast.media.MediaInfo(src, 'video/mp4');
        if (src.includes('.m3u8')) {
            mediaInfo.contentType = 'application/x-mpegurl';
        }

        const request = new window.chrome.cast.media.LoadRequest(mediaInfo);

        if (videoRef.current) {
            request.currentTime = videoRef.current.currentTime;
        }

        session.loadMedia(request).then(
            () => console.log('Cast: Media loaded successfully'),
            (error: unknown) => console.error('Cast: Media load failed', error)
        );
    }, [src, videoRef]);

    useEffect(() => {
        // Function to initialize Cast
        const initializeCastApi = () => {
            if (!window.cast?.framework) return;
            const cast = window.cast;

            const castContext = cast.framework.CastContext.getInstance();
            castContextRef.current = castContext;

            castContext.setOptions({
                receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
                autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
            });

            // Monitor cast state
            castContext.addEventListener(
                cast.framework.CastContextEventType.CAST_STATE_CHANGED,
                (event) => {
                    const state = event.castState;
                    setIsCastAvailable(state !== cast.framework.CastState.NO_DEVICES_AVAILABLE);
                }
            );

            // Initial state check
            const initialState = castContext.getCastState();
            setIsCastAvailable(initialState !== cast.framework.CastState.NO_DEVICES_AVAILABLE);

            // Monitor session state
            castContext.addEventListener(
                cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
                (event) => {
                    const sessionState = event.sessionState;
                    const isSessionActive = sessionState === cast.framework.SessionState.SESSION_STARTED ||
                        sessionState === cast.framework.SessionState.SESSION_RESUMED;

                    setIsCasting(isSessionActive);

                    if (isSessionActive && videoRef.current) {
                        videoRef.current.pause();
                        loadMedia();
                    }
                }
            );
        };

        // If API is already loaded
        if (window.cast && window.cast.framework) {
            initializeCastApi();
        } else {
            // Wait for API to be available
            window.__onGCastApiAvailable = (isAvailable: boolean) => {
                if (isAvailable) {
                    initializeCastApi();
                }
            };
        }
    }, [setIsCastAvailable, setIsCasting, videoRef, loadMedia]);

    const showCastMenu = useCallback(() => {
        if (window.cast?.framework) {
            window.cast.framework.CastContext.getInstance().requestSession();
        }
    }, []);

    const castActions = useMemo(() => ({
        showCastMenu
    }), [showCastMenu]);

    return castActions;
}
