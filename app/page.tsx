'use client';

import { Suspense } from 'react';
import { SearchForm } from '@/components/search/SearchForm';
import { NoResults } from '@/components/search/NoResults';
import { PopularFeatures } from '@/components/home/PopularFeatures';
import { WatchHistorySidebar } from '@/components/history/WatchHistorySidebar';
import { FavoritesSidebar } from '@/components/favorites/FavoritesSidebar';
import { Navbar } from '@/components/layout/Navbar';
import { SearchResults } from '@/components/home/SearchResults';
import { FullPageSpinner } from '@/components/ui/FullPageSpinner';
import { useHomePage } from '@/lib/hooks/useHomePage';

function HomePage() {
  const {
    query,
    hasSearched,
    loading,
    sourcesLoading,
    results,
    availableSources,
    completedSources,
    totalSources,
    failedSources,
    handleSearch,
    handleReset,
  } = useHomePage();

  const showResults = results.length > 0;

  return (
    <div className="min-h-screen">
      {/* Glass Navbar */}
      <Navbar onReset={handleReset} />

      {/* Search Form - Separate from navbar */}
      <div className="max-w-7xl mx-auto px-4 mt-6 mb-8 relative layer-gpu z-search-panel">
        <SearchForm
          onSearch={handleSearch}
          onClear={handleReset}
          isLoading={loading}
          sourcesLoading={sourcesLoading}
          initialQuery={query}
          currentSource=""
          checkedSources={completedSources}
          totalSources={totalSources}
        />
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {/* Results Section */}
        {showResults && (
          <SearchResults
            results={results}
            availableSources={availableSources}
            loading={loading}
            failedSourceCount={failedSources.length}
            searchKey={query}
          />
        )}

        {/* Popular Features - Homepage */}
        {!loading && !hasSearched && <PopularFeatures onSearch={handleSearch} />}

        {/* No Results */}
        {!loading && hasSearched && results.length === 0 && (
          <NoResults onReset={handleReset} failedSourceCount={failedSources.length} />
        )}
      </main>

      {/* Favorites Sidebar - Left */}
      <FavoritesSidebar />

      {/* Watch History Sidebar - Right */}
      <WatchHistorySidebar />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <HomePage />
    </Suspense>
  );
}
