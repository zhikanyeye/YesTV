import { useDeferredValue } from 'react';
import { ResultsHeader } from '@/components/search/ResultsHeader';
import { SourceBadges } from '@/components/search/SourceBadges';
import { TypeBadges } from '@/components/search/TypeBadges';
import { VideoGrid } from '@/components/search/VideoGrid';
import { useSourceBadges } from '@/lib/hooks/useSourceBadges';
import { useTypeBadges } from '@/lib/hooks/useTypeBadges';
import { Video, SourceBadge } from '@/lib/types';

interface SearchResultsProps {
    results: Video[];
    availableSources: SourceBadge[];
    loading: boolean;
    failedSourceCount?: number;
    searchKey?: string;
    isPremium?: boolean;
}

export function SearchResults({ results, availableSources, loading, failedSourceCount = 0, searchKey = '', isPremium = false }: SearchResultsProps) {
    const deferredResults = useDeferredValue(results);
    const deferredSources = useDeferredValue(availableSources);

    // Source badges hook - filters by video source
    const {
        selectedSources,
        filteredVideos: sourceFilteredVideos,
        toggleSource,
    } = useSourceBadges(deferredResults, deferredSources);

    // Type badges hook - auto-collects and filters by type_name
    // Apply on source-filtered results for combined filtering
    const {
        typeBadges,
        selectedTypes,
        filteredVideos: finalFilteredVideos,
        toggleType,
    } = useTypeBadges(sourceFilteredVideos);

    if (results.length === 0 && !loading) return null;

    return (
        <div className="animate-fade-in">
            <ResultsHeader
                loading={loading}
                resultsCount={results.length}
                failedSourceCount={failedSourceCount}
            />

            {/* Source Badges - Clickable video source filtering */}
            {deferredSources.length > 0 && (
                <SourceBadges
                    sources={deferredSources}
                    selectedSources={selectedSources}
                    onToggleSource={toggleSource}
                    className="mb-6"
                />
            )}

            {/* Type Badges - Auto-collected from search results */}
            {typeBadges.length > 0 && (
                <TypeBadges
                    badges={typeBadges}
                    selectedTypes={selectedTypes}
                    onToggleType={toggleType}
                    className="mb-6"
                />
            )}

            {/* Display filtered videos (both source and type filters applied) */}
            <VideoGrid key={searchKey} videos={finalFilteredVideos} isPremium={isPremium} />
        </div>
    );
}
