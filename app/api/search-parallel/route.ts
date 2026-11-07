/**
 * Parallel Streaming Search API Route
 * Searches all sources in parallel and streams results immediately as they arrive
 * No waiting - results flow in real-time
 */

import { NextRequest } from 'next/server';
import { searchVideos } from '@/lib/api/client';
import type { VideoItem, VideoSource } from '@/lib/types';
import { matchesSearchQuery } from '@/lib/utils/search';
import {
  searchCache,
  SEARCH_CACHE_TTL_MS,
  type CachedSourceSearch,
} from '@/lib/api/server-cache';
import {
  isSourceDisabled,
  recordSourceSuccess,
  recordSourceFailure,
} from '@/lib/api/source-health';


// Timeout configuration
const SEARCH_TIMEOUT_MS = 8000; // 8 second timeout for individual sources
const SEARCH_CONCURRENCY = 8;

function isVideoSource(value: unknown): value is VideoSource {
  if (!value || typeof value !== 'object') return false;
  const source = value as Partial<VideoSource>;
  return Boolean(source.id && source.name && source.baseUrl && typeof source.searchPath === 'string');
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const activeControllers = new Set<AbortController>();
  let cancelled = false;

  const abortActiveSearches = () => {
    cancelled = true;
    activeControllers.forEach(controller => controller.abort());
    activeControllers.clear();
  };

  request.signal.addEventListener('abort', abortActiveSearches, { once: true });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        if (cancelled) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const body = await request.json() as {
          query?: unknown;
          sources?: unknown;
          page?: unknown;
        };
        const { query, sources: sourceConfigs } = body;
        const page = typeof body.page === 'number' && body.page > 0 ? body.page : 1;

        // Validate input
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
          send({
            type: 'error',
            message: 'Invalid query'
          });
          controller.close();
          return;
        }

        // Use provided sources or fallback to empty (client should provide them)
        const sources = Array.isArray(sourceConfigs) && sourceConfigs.length > 0
          ? sourceConfigs.filter(isVideoSource)
          : [];

        if (sources.length === 0) {
          send({
            type: 'error',
            message: 'No valid sources provided'
          });
          controller.close();
          return;
        }

        // Send initial status
        send({
          type: 'start',
          totalSources: sources.length
        });

        // Track progress
        let completedSources = 0;
        let totalVideosFound = 0;

        const searchSource = async (source: VideoSource) => {
          const startTime = performance.now(); // Track start time

          // Skip sources that keep failing (auto-disabled by health tracker)
          if (isSourceDisabled(source.id)) {
            completedSources++;
            send({
              type: 'source-error',
              source: source.id,
              sourceName: source.name,
              message: 'Source temporarily disabled (repeated failures)',
            });
            send({
              type: 'progress',
              completedSources,
              totalSources: sources.length,
              totalVideosFound
            });
            return;
          }

          // Serve repeated queries from the server-side cache
          const cacheKey = `${source.id}:p${page}:${query.trim()}`;
          const cached = searchCache.get(cacheKey);
          if (cached) {
            completedSources++;
            totalVideosFound += cached.videos.length;
            send({
              type: 'videos',
              videos: cached.videos,
              source: source.id,
              completedSources,
              totalSources: sources.length,
              latency: cached.latency,
            });
            send({
              type: 'progress',
              completedSources,
              totalSources: sources.length,
              totalVideosFound
            });
            return;
          }

          const sourceController = new AbortController();
          let timedOut = false;
          const abortFromRequest = () => sourceController.abort();
          const timeoutId = setTimeout(() => {
            timedOut = true;
            sourceController.abort();
          }, SEARCH_TIMEOUT_MS);

          activeControllers.add(sourceController);
          request.signal.addEventListener('abort', abortFromRequest, { once: true });

          try {
            const result = await searchVideos(
              query.trim(),
              [source],
              page,
              sourceController.signal
            );
            
            const sourceResult = result[0];
            if (sourceResult?.error) {
              throw new Error(sourceResult.error);
            }
            const videos = (sourceResult?.results || []).filter(video =>
              matchesSearchQuery(video, query)
            );

            completedSources++;
            totalVideosFound += videos.length;

            const latency = Math.round(performance.now() - startTime);
            recordSourceSuccess(source.id);

            // Stream videos immediately as they arrive WITH latency data
            if (videos.length > 0) {
              const payload = videos.map((video: VideoItem) => ({
                ...video,
                sourceDisplayName: source.name,
                latency,
              }));

              searchCache.set(
                cacheKey,
                { videos: payload, latency } satisfies CachedSourceSearch,
                SEARCH_CACHE_TTL_MS
              );

              send({
                type: 'videos',
                videos: payload,
                source: source.id,
                completedSources,
                totalSources: sources.length,
                latency,
              });
            }

            // Send progress update
            send({
              type: 'progress',
              completedSources,
              totalSources: sources.length,
              totalVideosFound
            });

          } catch (error) {
            if (cancelled || request.signal.aborted) return;

            const endTime = performance.now();
            const latency = Math.round(endTime - startTime);

            // Log error but continue with other sources
            if (timedOut) {
              console.warn(`[Search Parallel] Source ${source.id} timed out after ${SEARCH_TIMEOUT_MS}ms`);
            } else {
              console.error(`[Search Parallel] Source ${source.id} failed after ${latency}ms:`, error);
            }

            recordSourceFailure(source.id);
            completedSources++;

            send({
              type: 'source-error',
              source: source.id,
              sourceName: source.name,
              message: timedOut ? 'Search timed out' : 'Search failed'
            });

            send({
              type: 'progress',
              completedSources,
              totalSources: sources.length,
              totalVideosFound
            });
          } finally {
            clearTimeout(timeoutId);
            activeControllers.delete(sourceController);
            request.signal.removeEventListener('abort', abortFromRequest);
          }
        };

        let nextSourceIndex = 0;
        const worker = async () => {
          while (!cancelled) {
            const sourceIndex = nextSourceIndex++;
            if (sourceIndex >= sources.length) return;
            await searchSource(sources[sourceIndex]);
          }
        };

        const workerCount = Math.min(SEARCH_CONCURRENCY, sources.length);
        await Promise.all(Array.from({ length: workerCount }, () => worker()));

        if (cancelled) return;

        send({
          type: 'complete',
          totalVideosFound,
          totalSources: sources.length
        });

        controller.close();

      } catch (error) {
        if (cancelled) return;
        console.error('Search error:', error);
        send({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        controller.close();
      }
    },
    cancel() {
      abortActiveSearches();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
