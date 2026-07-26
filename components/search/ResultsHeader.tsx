'use client';

import { Badge } from '@/components/ui/Badge';
import { Icons } from '@/components/ui/Icon';

interface ResultsHeaderProps {
  loading: boolean;
  resultsCount: number;
  failedSourceCount?: number;
}

export function ResultsHeader({
  loading,
  resultsCount,
  failedSourceCount = 0,
}: ResultsHeaderProps) {
  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-2xl font-bold text-[var(--text-color)] flex items-center gap-3">
          <span>搜索结果</span>
        </h3>
        <div className="flex items-center gap-3">
          {loading && (
            <Badge variant="secondary" className="text-sm">
              <span className="flex items-center gap-2">
                <Icons.Search size={14} />
                搜索中...
              </span>
            </Badge>
          )}
          {!loading && (
            <>
              <Badge variant="primary">{resultsCount} 个视频</Badge>
              {failedSourceCount > 0 && (
                <Badge variant="secondary">{failedSourceCount} 个源失败</Badge>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
