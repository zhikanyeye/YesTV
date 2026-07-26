import { Video } from '@/lib/types';
import { getSourceName } from '@/lib/utils/source-names';
import { calculateRelevanceScore } from '@/lib/utils/search';

interface StreamHandlerParams {
    reader: ReadableStreamDefaultReader<Uint8Array>;
    onStart: (totalSources: number) => void;
    onVideos: (videos: Video[], source: string) => void;
    onProgress: (completedSources: number, totalVideosFound: number) => void;
    onSourceError: (sourceId: string) => void;
    onComplete: () => void;
    onError: (message: string) => void;
    currentQuery: string;
}

type StreamVideo = Video & { sourceDisplayName?: string };

export async function processSearchStream({
    reader,
    onStart,
    onVideos,
    onProgress,
    onSourceError,
    onComplete,
    onError,
    currentQuery,
}: StreamHandlerParams) {
    const decoder = new TextDecoder();
    let buffer = '';
    let isCompleted = false;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;

                try {
                    const data = JSON.parse(line.slice(6));

                    if (data.type === 'start') {
                        onStart(data.totalSources);
                    } else if (data.type === 'videos') {
                        const videos = Array.isArray(data.videos) ? data.videos : [];
                        const newVideos: Video[] = videos
                            .filter((video: unknown): video is StreamVideo => {
                                if (!video || typeof video !== 'object') return false;
                                return typeof (video as StreamVideo).vod_name === 'string';
                            })
                            .map((video: StreamVideo) => ({
                                ...video,
                                sourceName: video.sourceDisplayName || getSourceName(video.source),
                                isNew: true,
                                relevanceScore: calculateRelevanceScore(video, currentQuery),
                            }));
                        if (newVideos.length > 0) {
                            onVideos(newVideos, data.source);
                        }
                    } else if (data.type === 'progress') {
                        onProgress(data.completedSources, data.totalVideosFound);
                    } else if (data.type === 'source-error') {
                        onSourceError(data.source);
                    } else if (data.type === 'complete') {
                        if (!isCompleted) {
                            isCompleted = true;
                            onComplete();
                        }
                    } else if (data.type === 'error') {
                        isCompleted = true;
                        onError(data.message);
                    }
                } catch (error) {
                    console.error('Error parsing stream data:', error);
                }
            }
        }

        if (!isCompleted) {
            isCompleted = true;
            onError('Search stream ended unexpectedly');
        }
    } catch (error) {
        throw error;
    }
}
