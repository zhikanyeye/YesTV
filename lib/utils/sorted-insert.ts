/**
 * Binary insert utility for sorted arrays
 */

import type { Video } from '@/lib/types';

function compareVideos(a: Video, b: Video): number {
    const relevanceDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
    if (relevanceDiff !== 0) return relevanceDiff;
    return (a.latency || 99999) - (b.latency || 99999);
}

export function binaryInsertVideos<T extends Video>(existing: T[], newVideos: T[]): T[] {
    if (newVideos.length === 0) return existing;
    if (existing.length === 0) return [...newVideos].sort(compareVideos);

    const incoming = [...newVideos].sort(compareVideos);
    const merged: T[] = [];
    let existingIndex = 0;
    let incomingIndex = 0;

    while (existingIndex < existing.length && incomingIndex < incoming.length) {
        if (compareVideos(existing[existingIndex], incoming[incomingIndex]) <= 0) {
            merged.push(existing[existingIndex++]);
        } else {
            merged.push(incoming[incomingIndex++]);
        }
    }

    return merged.concat(existing.slice(existingIndex), incoming.slice(incomingIndex));
}
