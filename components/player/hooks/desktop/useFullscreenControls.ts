import { useCallback, useEffect, useMemo } from 'react';

declare global {
    interface HTMLElement {
        webkitRequestFullscreen?: () => Promise<void> | void;
        mozRequestFullScreen?: () => Promise<void> | void;
        msRequestFullscreen?: () => Promise<void> | void;
    }

    interface HTMLVideoElement {
        webkitEnterFullscreen?: () => void;
        webkitShowPlaybackTargetPicker?: () => void;
    }

    interface Document {
        webkitExitFullscreen?: () => Promise<void> | void;
        mozCancelFullScreen?: () => Promise<void> | void;
        msExitFullscreen?: () => Promise<void> | void;
        webkitFullscreenElement?: Element | null;
        mozFullScreenElement?: Element | null;
        msFullscreenElement?: Element | null;
    }

    interface ScreenOrientation {
        lock?: (orientation: string) => Promise<void>;
    }
}

interface UseFullscreenControlsProps {
    containerRef: React.RefObject<HTMLDivElement | null>;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isFullscreen: boolean;
    setIsFullscreen: (fullscreen: boolean) => void;
    isPiPSupported: boolean;
    isAirPlaySupported: boolean;
    setIsPiPSupported: (supported: boolean) => void;
    setIsAirPlaySupported: (supported: boolean) => void;
}

export function useFullscreenControls({
    containerRef,
    videoRef,
    isFullscreen,
    setIsFullscreen,
    isPiPSupported,
    isAirPlaySupported,
    setIsPiPSupported,
    setIsAirPlaySupported
}: UseFullscreenControlsProps) {
    useEffect(() => {
        if (typeof document !== 'undefined') {
            setIsPiPSupported('pictureInPictureEnabled' in document);
        }
        if (typeof window !== 'undefined') {
            setIsAirPlaySupported('WebKitPlaybackTargetAvailabilityEvent' in window);
        }
    }, [setIsPiPSupported, setIsAirPlaySupported]);

    const toggleFullscreen = useCallback(async () => {
        if (!containerRef.current) return;

        if (!isFullscreen) {
            try {
                if (containerRef.current.requestFullscreen) {
                    await containerRef.current.requestFullscreen();
                } else if (containerRef.current.webkitRequestFullscreen) {
                    await containerRef.current.webkitRequestFullscreen();
                } else if (containerRef.current.mozRequestFullScreen) {
                    await containerRef.current.mozRequestFullScreen();
                } else if (containerRef.current.msRequestFullscreen) {
                    await containerRef.current.msRequestFullscreen();
                } else if (videoRef.current?.webkitEnterFullscreen) {
                    // Fallback for browsers that only support fullscreen on video element (like some car browsers)
                    videoRef.current.webkitEnterFullscreen();
                }

                // Lock orientation to landscape on mobile devices if supported
                if (window.screen.orientation?.lock) {
                    try {
                        await window.screen.orientation.lock('landscape');
                    } catch (error) {
                        console.warn('Orientation lock failed:', error);
                    }
                }
            } catch (error) {
                console.warn('Fullscreen request failed, trying fallback:', error);
                // Last ditch effort: try native video fullscreen if container failed
                if (videoRef.current?.webkitEnterFullscreen) {
                    try {
                        videoRef.current.webkitEnterFullscreen();
                    } catch (fallbackError) {
                        console.error('Final fullscreen fallback failed:', fallbackError);
                    }
                }
            }
        } else {
            try {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    await document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    await document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    await document.msExitFullscreen();
                }

                // Unlock orientation when exiting fullscreen
                if (window.screen.orientation?.unlock) {
                    try {
                        window.screen.orientation.unlock();
                    } catch (error) {
                        console.warn('Orientation unlock failed:', error);
                    }
                }
            } catch (error) {
                console.error('Failed to exit fullscreen:', error);
            }
        }
    }, [containerRef, videoRef, isFullscreen]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            const isInFullscreen = !!(
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement
            );
            setIsFullscreen(isInFullscreen);

            // Double check orientation lock/unlock on change
            if (isInFullscreen) {
                if (window.screen.orientation?.lock) {
                    window.screen.orientation.lock('landscape').catch(() => { });
                }
            } else {
                if (window.screen.orientation?.unlock) {
                    try {
                        window.screen.orientation.unlock();
                    } catch { }
                }
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        };
    }, [setIsFullscreen]);

    const togglePictureInPicture = useCallback(async () => {
        if (!videoRef.current || !isPiPSupported) return;
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await videoRef.current.requestPictureInPicture();
            }
        } catch (error) {
            console.error('Failed to toggle Picture-in-Picture:', error);
        }
    }, [videoRef, isPiPSupported]);

    const showAirPlayMenu = useCallback(() => {
        if (!videoRef.current || !isAirPlaySupported) return;
        if (videoRef.current.webkitShowPlaybackTargetPicker) {
            videoRef.current.webkitShowPlaybackTargetPicker();
        }
    }, [videoRef, isAirPlaySupported]);

    const fullscreenActions = useMemo(() => ({
        toggleFullscreen,
        togglePictureInPicture,
        showAirPlayMenu
    }), [toggleFullscreen, togglePictureInPicture, showAirPlayMenu]);

    return fullscreenActions;
}
