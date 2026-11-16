import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isCustomSource, mergeRemoteSources } from './sources-sync';
import type { VideoSource } from '@/lib/types';

const make = (id: string, name: string): VideoSource => ({
    id, name, baseUrl: 'https://example.com',
    searchPath: '/api.php/provide/vod/', detailPath: '/api.php/provide/vod/',
    enabled: true, priority: 1, group: 'normal',
});

test('only hash-prefixed sources are treated as custom', () => {
    assert.equal(isCustomSource(make('source_abc', '自定义')), true);
    assert.equal(isCustomSource(make('dytt', '电影天堂资源')), false);
});

test('remote sources merge without duplicating local ids', () => {
    const local = [make('dytt', '电影天堂资源'), make('source_a', '本地源')];
    const remote = [make('source_a', '远端旧名'), make('source_b', '远端源')];
    const merged = mergeRemoteSources(local, remote);
    assert.deepEqual(merged.map((s) => s.id), ['dytt', 'source_a', 'source_b']);
    assert.equal(merged[1].name, '本地源', 'local value wins on id conflict');
});

test('merging empty remote keeps local untouched', () => {
    const local = [make('source_a', '本地源')];
    assert.deepEqual(mergeRemoteSources(local, []), local);
});
