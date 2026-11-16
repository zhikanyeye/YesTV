import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSourceUrl, normalizeVideoSource } from './source-normalization';
import { parseSourcesFromJson } from './source-import-utils';

test('domain and incomplete MacCMS URLs become vod endpoints', () => {
    for (const address of ['example.com', 'https://example.com/',
        'https://example.com/api.php', 'https://example.com/api.php/provide/',
        'https://example.com/api.php/provide/json/']) {
        assert.equal(normalizeSourceUrl(address).href, 'https://example.com/api.php/provide/vod/');
    }
    assert.equal(normalizeSourceUrl('example.com:8080').port, '8080');
    assert.equal(normalizeSourceUrl('http://example.com').protocol, 'http:');
});

test('request-specific parameters are cleared while source parameters survive', () => {
    const url = normalizeSourceUrl('https://example.com/api.php/provide/vod/?ac=list&wd=old&ids=9&pg=3&at=xml&token=demo#fragment');
    assert.equal(url.searchParams.get('token'), 'demo');
    assert.equal(url.searchParams.get('at'), 'json');
    assert.equal(url.hash, '');
    assert.equal(url.searchParams.has('ids'), false);
    assert.equal(url.searchParams.has('wd'), false);
    assert.equal(normalizeSourceUrl('https://example.com/api.php/provide/vod/at/xml').pathname,
        '/api.php/provide/vod/at/json');
});

test('custom paths, identifiers and headers survive normalization and JSON round trips', () => {
    const source = normalizeVideoSource({ id: 'custom', name: '测试源', baseUrl: 'https://example.com/cms',
        searchPath: '/search.php?token=demo', detailPath: '/detail.php',
        headers: { Referer: 'https://example.com' }, group: 'premium', enabled: false });
    assert.equal(source.searchPath, '/cms/search.php?token=demo');
    assert.equal(source.detailPath, '/cms/detail.php');
    assert.deepEqual(normalizeVideoSource(source), source);
    assert.deepEqual(parseSourcesFromJson(JSON.stringify([source])).premiumSources, [source]);
    assert.equal(normalizeSourceUrl('https://example.com/custom/').pathname, '/custom/');
    const withQuery = normalizeVideoSource({ baseUrl: 'https://example.com/cms?token=demo',
        searchPath: '/search/', detailPath: '/detail/' });
    assert.equal(withQuery.searchPath, '/cms/search/?token=demo');
    assert.equal(withQuery.detailPath, '/cms/detail/?token=demo');
    assert.deepEqual(normalizeVideoSource(withQuery), withQuery);
});

test('single JSON object, aliases and list wrappers are supported', () => {
    for (const key of ['api', 'url', 'baseUrl']) {
        assert.equal(parseSourcesFromJson(JSON.stringify({ [key]: 'example.com' })).totalCount, 1);
    }
    for (const key of ['sources', 'sites', 'list']) {
        const result = parseSourcesFromJson(JSON.stringify({ [key]: [{ name: '视频源', api: 'example.com' }] }));
        assert.equal(result.normalSources[0].name, '视频源');
    }
    assert.equal(parseSourcesFromJson('{"api_site":{"demo":{"name":"Demo","api":"example.com"}}}')
        .normalSources[0].id, 'demo');
});

test('URL-derived identifiers are stable and handle Chinese source names', () => {
    const first = normalizeVideoSource({ name: '中文源', api: 'example.com' });
    const second = normalizeVideoSource({ name: '新名称', url: 'https://example.com/api.php/provide/vod/' });
    assert.equal(first.id, second.id);
    assert.notEqual(first.id, normalizeVideoSource('other.example.com').id);
});

test('invalid input is rejected and valid mixed list entries are retained', () => {
    for (const input of ['javascript:alert(1)', 'ftp://example.com', 'https://', '']) {
        assert.throws(() => normalizeVideoSource(input));
    }
    for (const json of ['null', '{}', '{"list":[{"vod_id":1}]}']) {
        assert.throws(() => parseSourcesFromJson(json));
    }
    assert.equal(parseSourcesFromJson('[null,{"api":"example.com"}]').totalCount, 1);
});
