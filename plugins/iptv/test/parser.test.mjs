import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseM3U } from '../dist/index.js';

const fixture = await readFile(new URL('./fixtures/basic.m3u', import.meta.url), 'utf8');

const options = {
  playlistId: 'playlist:one',
  playlistName: 'Example Playlist',
  source: 'https://example.com/playlist.m3u',
  updatedAt: 1700000000000
};

test('parses M3U metadata and valid channels', () => {
  const result = parseM3U(fixture, options);

  assert.deepEqual(result.playlist, {
    id: 'playlist:one',
    name: 'Example Playlist',
    source: 'https://example.com/playlist.m3u',
    updatedAt: 1700000000000
  });
  assert.equal(result.channels.length, 3);
  assert.deepEqual(result.channels[0], {
    id: 'playlist:one::36461947',
    playlistId: 'playlist:one',
    name: 'Example News',
    group: 'News',
    streamUrl: 'https://stream.example/news.m3u8',
    logo: 'https://cdn.example/logo.png',
    language: 'en',
    country: 'US'
  });
  assert.equal(result.channels[1].name, 'Example Music');
  assert.equal(result.channels[2].name, 'Last Channel');
});

test('reports malformed entries while retaining valid channels', () => {
  const result = parseM3U(fixture, options);

  assert.deepEqual(
    result.diagnostics.map(({ code }) => code),
    ['duplicate-channel', 'invalid-url', 'missing-name', 'missing-url']
  );
  assert.equal(result.diagnostics.find(({ code }) => code === 'invalid-url')?.value, 'javascript:alert(1)');
});

test('produces stable IDs and isolates equal streams by playlist', () => {
  const first = parseM3U(
    '#EXTM3U\n#EXTINF:-1,Channel\nhttps://stream.example/channel',
    options
  );
  const second = parseM3U(
    '#EXTM3U\n#EXTINF:-1,Channel\nhttps://stream.example/channel',
    { ...options, playlistId: 'playlist:two' }
  );

  assert.equal(first.channels[0].id, parseM3U(
    '#EXTM3U\n#EXTINF:-1,Channel\nhttps://stream.example/channel',
    options
  ).channels[0].id);
  assert.notEqual(first.channels[0].id, second.channels[0].id);
  assert.equal(first.channels[0].playlistId, 'playlist:one');
  assert.equal(second.channels[0].playlistId, 'playlist:two');
});

test('rejects empty playlist metadata and invalid source', () => {
  assert.throws(
    () => parseM3U('', { ...options, playlistId: ' ' }),
    /Playlist ID must not be empty/
  );
  assert.throws(
    () => parseM3U('', { ...options, playlistName: ' ' }),
    /Playlist name must not be empty/
  );
  assert.throws(
    () => parseM3U('', { ...options, source: 'not a URL' }),
    /Playlist source must be a valid URL/
  );
});
