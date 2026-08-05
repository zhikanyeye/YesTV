import { useEffect } from 'react';

declare global {
    interface ScreenOrientation {
        lock?: (orientation: string) => Promise<void>;
    }
}

/**
 * Hook for managing screen orientation on mobile devices
 * Auto-rotates to landscape on fullscreen, portrait on exit
 */
export function useScreenOrientation(isFullscreen: boolean) {
    useEffect(() => {
        if (typeof window === 'undefined' || !('screen' in window)) return;

        const handleOrientation = async () => {
            try {
                const screen = window.screen;

                if (isFullscreen) {
                    // Fullscreen: Lock to landscape
                    if (screen.orientation?.lock) {
                        await screen.orientation.lock('landscape').catch((error: unknown) => {
                            console.warn('Could not lock orientation:', error);
                        });
                    }
                } else {
                    // Exit fullscreen: Unlock to allow portrait
                    if (screen.orientation?.unlock) {
                        screen.orientation.unlock();
                    }
                }
            } catch (error) {
                console.warn('Orientation API not supported:', error);
            }
        };

        handleOrientation();

        // Cleanup: Always unlock on unmount
        return () => {
            try {
                const screen = window.screen;
                if (screen.orientation?.unlock) {
                    screen.orientation.unlock();
                }
            } catch {
                // Ignore cleanup errors
            }
        };
    }, [isFullscreen]);
}
