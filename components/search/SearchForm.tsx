'use client';

import { SearchLoadingAnimation } from '@/components/SearchLoadingAnimation';
import { SearchBox } from './SearchBox';

interface SearchFormProps {
  onSearch: (query: string) => void;
  onClear?: () => void;
  isLoading: boolean;
  sourcesLoading?: boolean;
  initialQuery?: string;
  currentSource?: string;
  checkedSources?: number;
  totalSources?: number;
  placeholder?: string;
}

export function SearchForm({
  onSearch,
  onClear,
  isLoading,
  sourcesLoading = false,
  initialQuery = '',
  currentSource = '',
  checkedSources = 0,
  totalSources = 16,
  placeholder,
}: SearchFormProps) {
  return (
    <div className="max-w-3xl mx-auto">
      <SearchBox
        onSearch={onSearch}
        onClear={onClear}
        initialQuery={initialQuery}
        placeholder={placeholder}
        disabled={sourcesLoading}
      />

      {/* Sources Loading Indicator */}
      {sourcesLoading && (
        <div className="mt-4 flex items-center justify-center gap-2 text-[var(--text-color-secondary)]">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--accent-color)] border-t-transparent"></div>
          <span className="text-sm">正在加载资源源...</span>
        </div>
      )}

      {/* Search Loading Animation */}
      {isLoading && !sourcesLoading && (
        <div className="mt-4">
          <SearchLoadingAnimation
            currentSource={currentSource}
            checkedSources={checkedSources}
            totalSources={totalSources}
          />
        </div>
      )}
    </div>
  );
}
