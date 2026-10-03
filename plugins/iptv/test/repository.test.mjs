import assert from 'node:assert/strict';
import test from 'node:test';

import { StorageIPTVRepository } from '../dist/index.js';

class MemoryCollection {
  constructor() {
    this.records = new Map();
    this.failPut = false;
  }

  async get(id) {
    return this.records.get(id);
  }

  async put(record) {
    if (this.failPut) {
      this.failPut = false;
      throw new Error('injected put failure');
    }
    this.records.set(record.id, structuredClone(record));
  }

  async delete(id) {
    this.records.delete(id);
  }

  async list(query = {}) {
    return [...this.records.values()]
      .filter((record) => Object.entries(query.where ?? {})
        .every(([key, value]) => record[key] === value))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  async clear() {
    this.records.clear();
  }
}

class MemoryStorage {
  constructor() {
    this.collections = new Map();
  }

  collection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new MemoryCollection());
    return this.collections.get(name);
  }
}

const playlist = {
  id: 'playlist:one',
  name: 'Example Playlist',
  updatedAt: 1700000000000
};

const firstChannel = {
  id: 'playlist:one::first',
  playlistId: 'playlist:one',
  name: 'First',
  streamUrl: 'https://example.com/first'
};

const secondChannel = {
  id: 'playlist:one::second',
  playlistId: 'playlist:one',
  name: 'Second',
  group: 'News',
  streamUrl: 'https://example.com/second'
};

test('persists playlists and replaces channels within a playlist', async () => {
  const storage = new MemoryStorage();
  const repository = new StorageIPTVRepository(storage);

  await repository.replacePlaylist({
    playlist,
    channels: [firstChannel, secondChannel],
    diagnostics: []
  });
  assert.deepEqual(await repository.listPlaylists(), [playlist]);
  assert.deepEqual(await repository.listChannels({ playlistId: playlist.id }), [
    firstChannel,
    secondChannel
  ]);

  await repository.replacePlaylist({
    playlist: { ...playlist, updatedAt: 1700000001000 },
    channels: [firstChannel],
    diagnostics: []
  });
  assert.equal((await repository.listChannels({ playlistId: playlist.id })).length, 1);
  assert.equal((await repository.getPlaylist(playlist.id)).updatedAt, 1700000001000);
});

test('filters channels by group and isolates playlists', async () => {
  const storage = new MemoryStorage();
  const repository = new StorageIPTVRepository(storage);
  const otherChannel = { ...firstChannel, id: 'playlist:two::first', playlistId: 'playlist:two' };

  await repository.replacePlaylist({ playlist, channels: [firstChannel, secondChannel], diagnostics: [] });
  await repository.replacePlaylist({
    playlist: { id: 'playlist:two', name: 'Other', updatedAt: 1700000000000 },
    channels: [otherChannel],
    diagnostics: []
  });

  assert.deepEqual(
    (await repository.listChannels({ playlistId: playlist.id, group: 'News' })).map(({ id }) => id),
    [secondChannel.id]
  );
  assert.deepEqual(
    (await repository.listChannels({ playlistId: 'playlist:two' })).map(({ id }) => id),
    [otherChannel.id]
  );
});

test('compensates a failed playlist replacement', async () => {
  const storage = new MemoryStorage();
  const repository = new StorageIPTVRepository(storage);

  await repository.replacePlaylist({ playlist, channels: [firstChannel], diagnostics: [] });
  storage.collection('iptv-channels').failPut = true;

  await assert.rejects(
    repository.replacePlaylist({
      playlist: { ...playlist, name: 'Changed' },
      channels: [secondChannel],
      diagnostics: []
    }),
    /injected put failure/
  );
  assert.deepEqual(await repository.getPlaylist(playlist.id), playlist);
  assert.deepEqual(await repository.listChannels({ playlistId: playlist.id }), [firstChannel]);
});

test('deletes a playlist and its channels', async () => {
  const storage = new MemoryStorage();
  const repository = new StorageIPTVRepository(storage);

  await repository.replacePlaylist({ playlist, channels: [firstChannel], diagnostics: [] });
  await repository.deletePlaylist(playlist.id);

  assert.equal(await repository.getPlaylist(playlist.id), undefined);
  assert.deepEqual(await repository.listChannels({ playlistId: playlist.id }), []);
});
