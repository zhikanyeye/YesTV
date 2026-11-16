/**
 * Form hook for AddSourceModal
 */

'use client';

import { useState } from 'react';
import type { VideoSource } from '@/lib/types';
import { normalizeVideoSource } from '@/lib/utils/source-normalization';
import { parseSourcesFromJson } from '@/lib/utils/source-import-utils';
import { findDuplicateSource } from '@/lib/utils/source-dedup';

interface UseAddSourceFormProps {
    existingIds: string[];
    existingSources?: VideoSource[];
    onAdd: (source: VideoSource) => void;
    onClose: () => void;
    initialValues?: VideoSource | null;
}

export function useAddSourceForm({ existingIds, existingSources, onAdd, onClose, initialValues }: UseAddSourceFormProps) {
    const [name, setName] = useState(initialValues?.name || '');
    const initialUrl = initialValues ? initialValues.baseUrl + initialValues.searchPath : '';
    const [url, setUrl] = useState(initialUrl);
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!url.trim()) {
            setError('请填写视频源地址或 JSON 配置');
            return;
        }

        try {
            let input: unknown = url.trim();
            if (/^[{\["]/.test(url.trim())) {
                const result = parseSourcesFromJson(url);
                if (result.totalCount !== 1) {
                    setError('此处请填写单个视频源，多个源请使用批量导入');
                    return;
                }
                input = [...result.normalSources, ...result.premiumSources][0];
            }
            const normalized = initialValues && url.trim() === initialUrl.trim()
                ? initialValues : normalizeVideoSource(input);
            const newSource: VideoSource = {
                ...normalized,
                id: initialValues?.id || normalized.id,
                name: name.trim() || normalized.name,
                enabled: initialValues?.enabled ?? normalized.enabled,
                priority: initialValues?.priority ?? existingIds.length + 1,
                group: initialValues?.group ?? normalized.group,
                ...(initialValues?.headers ? { headers: initialValues.headers } : {}),
            };
            if (!initialValues) {
                // 兼容只传 existingIds 的调用方
                if (existingSources) {
                    const duplicate = findDuplicateSource(newSource, existingSources);
                    if (duplicate) {
                        setError(`此视频源已存在：${duplicate.name}，请编辑已有源`);
                        return;
                    }
                } else if (existingIds.includes(newSource.id)) {
                    setError('此视频源已存在，请编辑已有源');
                    return;
                }
            }
            onAdd(newSource);
            onClose();
        } catch (error) {
            setError(error instanceof Error ? error.message : '请输入有效的视频源地址或 JSON 配置');
        }
    };

    return {
        name,
        setName,
        url,
        setUrl,
        error,
        handleSubmit,
    };
}
