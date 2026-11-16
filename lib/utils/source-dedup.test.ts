import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findDuplicateSource, sourceEndpoint } from './source-dedup';
import { normalizeVideoSource } from './source-normalization';
import type { VideoSource } from '@/lib/types';

const base: VideoSource = {
    id: 'existing', name: '已有源', baseUrl: 'https://example.com',
    searchPath: '/api.php/provide/vod/', detailPath: '/api.php/provide/vod/',
    enabled: true, priority: 1, group: 'normal',
};

test('same endpoint with different id is detected as duplicate', () => {
    const incoming = normalizeVideoSource('example.com');
    assert.notEqual(incoming.id, base.id);
    assert.equal(sourceEndpoint(incoming), sourceEndpoint(base));
    assert.equal(findDuplicateSource(incoming, [base])?.id, 'existing');
});

test('genuinely different domains are not duplicates', () => {
    const other = normalizeVideoSource('another-example.com');
    assert.equal(findDuplicateSource(other, [base]), undefined);
});

test('editing the same source does not flag itself', () => {
    assert.equal(findDuplicateSource(base, [base], base.id), undefined);
    assert.equal(findDuplicateSource(base, [base])?.id, 'existing');
});

test('trailing slash and empty search path still match', () => {
    const trimmed = { ...base, baseUrl: 'https://example.com/', searchPath: '' };
    assert.equal(findDuplicateSource(base, [trimmed])?.id, 'existing');
});
