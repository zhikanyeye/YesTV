import { useEffect } from 'react';

const POLL_INTERVAL_MS = 1000;
const TIME_UPDATE_THRESHOLD_SECONDS = 0.25;
const DURATION_UPDATE_THRESHOLD_SECONDS = 0.5;

interface UsePlaybackPollingProps {
    isPlaying: boolean;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    isDraggingProgressRef: React.MutableRefObject<boolean>;
    setCurrentTime: (time: number) => void;
    setDuration: (duration: number) => void;
    setIsPlaying: (playing: boolean) => void;
}

/**
 * Polling fallback for AirPlay and throttled events
 * Updates playback progress manually when events are suppressed
 */
export function usePlaybackPolling({
    isPlaying,
    videoRef,
    isDraggingProgressRef,
    setCurrentTime,
    setDuration,
    setIsPlaying
}: UsePlaybackPollingProps) {
    useEffect(() => {
        if (!videoRef.current) return;
        if (!isPlaying) return;

        let lastCurrentTime = videoRef.current.currentTime || 0;
        let lastDuration = videoRef.current.duration || 0;

        const interval = setInterval(() => {
            if (videoRef.current) {
                // Sync play/pause state (crucial for AirPlay where events might be missed)
                const isVideoPaused = videoRef.current.paused;
                if (isVideoPaused === isPlaying && !isDraggingProgressRef.current) {
                    // State mismatch detected (e.g. AirPlay paused but app thinks playing)
                    setIsPlaying(!isVideoPaused);
                }

                if (!isDraggingProgressRef.current && !isVideoPaused) {
                    const current = videoRef.current.currentTime;
                    const total = videoRef.current.duration;

                    // Only update if significantly different to avoid jitter
                    if (Math.abs(current - lastCurrentTime) >= TIME_UPDATE_THRESHOLD_SECONDS) {
                        lastCurrentTime = current;
                        setCurrentTime(current);
                    }

                    if (!isNaN(total) && total > 0 && Math.abs(total - lastDuration) >= DURATION_UPDATE_THRESHOLD_SECONDS) {
                        lastDuration = total;
                        setDuration(total);
                    }
                }
            }
        }, POLL_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [isPlaying, videoRef, isDraggingProgressRef, setCurrentTime, setDuration, setIsPlaying]);
}
