import { useState, useEffect } from 'react';

/**
 * Hook to detect if the device is mobile
 */
export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const ua = navigator.userAgent || '';
            const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
            const maxTouchPoints = (navigator as any).maxTouchPoints || 0;
            const iPadOsDesktopUa = navigator.platform === 'MacIntel' && maxTouchPoints > 1;
            const coarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
            const noHover = typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches;
            const touchPrimary = !!(coarsePointer && noHover);

            const mobile = uaMobile || iPadOsDesktopUa || touchPrimary || window.innerWidth < 768;
            setIsMobile(mobile);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return isMobile;
}

/**
 * Hook to detect if the device is iOS
 */
export function useIsIOS() {
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        const checkIOS = () => {
            const ua = navigator.userAgent || '';
            const maxTouchPoints = (navigator as any).maxTouchPoints || 0;
            const iPadOsDesktopUa = navigator.platform === 'MacIntel' && maxTouchPoints > 1;
            const ios = (/iPad|iPhone|iPod/.test(ua) || iPadOsDesktopUa) && !(window as any).MSStream;
            setIsIOS(ios);
        };

        checkIOS();
    }, []);

    return isIOS;
}
