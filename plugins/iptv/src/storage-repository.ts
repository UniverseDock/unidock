import type { Storage, StorageCollection, StorageRecord } from '@unidock/storage';
import type { Channel, ChannelQuery, ParsePlaylistResult, Playlist } from './model.js';
import type { IPTVRepository } from './repository.js';

const PLAYLISTS_COLLECTION = 'iptv-playlists';
const CHANNELS_COLLECTION = 'iptv-channels';

export class StorageIPTVRepository implements IPTVRepository {
  private readonly playlists;
  private readonly channels;

  constructor(storage: Storage) {
    this.playlists = storage.collection<PlaylistRecord>(PLAYLISTS_COLLECTION);
    this.channels = storage.collection<ChannelRecord>(CHANNELS_COLLECTION);
  }

  async getPlaylist(id: string): Promise<Playlist | undefined> {
    const record = await this.playlists.get(id);
    return record ? toPlaylist(record) : undefined;
  }

  async listPlaylists(): Promise<Playlist[]> {
    const records = await this.playlists.list();
    return records.map(toPlaylist);
  }

  async getChannel(id: string): Promise<Channel | undefined> {
    const record = await this.channels.get(id);
    return record ? toChannel(record) : undefined;
  }

  async listChannels(query: ChannelQuery = {}): Promise<Channel[]> {
    const where: Record<string, unknown> = {};
    if (query.playlistId !== undefined) where.playlistId = query.playlistId;
    if (query.group !== undefined) where.group = query.group;

    const records = await this.channels.list({ where });
    const offset = Math.max(0, query.offset ?? 0);
    const end = query.limit === undefined ? undefined : offset + Math.max(0, query.limit);
    return records.map(toChannel).slice(offset, end);
  }

  async replacePlaylist(result: ParsePlaylistResult): Promise<void> {
    const previousPlaylist = await this.playlists.get(result.playlist.id);
    const previousChannels = await this.channels.list({
      where: { playlistId: result.playlist.id }
    });

    try {
      await this.playlists.put({ ...result.playlist } satisfies PlaylistRecord);
      for (const channel of previousChannels) await this.channels.delete(channel.id);
      for (const channel of result.channels) {
        await this.channels.put({ ...channel } satisfies ChannelRecord);
      }
    } catch (error) {
      await restorePlaylist(this.playlists, this.channels, result.playlist.id, previousPlaylist, previousChannels);
      throw error;
    }
  }

  async deletePlaylist(id: string): Promise<void> {
    const playlist = await this.playlists.get(id);
    const channels = await this.channels.list({ where: { playlistId: id } });
    try {
      await this.playlists.delete(id);
      for (const channel of channels) await this.channels.delete(channel.id);
    } catch (error) {
      await restorePlaylist(this.playlists, this.channels, id, playlist, channels);
      throw error;
    }
  }
}

type PlaylistRecord = Playlist & StorageRecord;
type ChannelRecord = Channel & StorageRecord;

async function restorePlaylist(
  playlists: StorageCollection<PlaylistRecord>,
  channels: StorageCollection<ChannelRecord>,
  playlistId: string,
  previousPlaylist: PlaylistRecord | undefined,
  previousChannels: ChannelRecord[]
): Promise<void> {
  try {
    if (previousPlaylist) await playlists.put(previousPlaylist);
    else await playlists.delete(playlistId);
    const currentChannels = await channels.list({ where: { playlistId } });
    for (const channel of currentChannels) await channels.delete(channel.id);
    for (const channel of previousChannels) await channels.put(channel);
  } catch {
    // The original operation is the actionable error; compensation is best effort.
  }
}

function toPlaylist(record: PlaylistRecord): Playlist {
  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.updatedAt !== 'number'
  ) {
    throw new Error(`Invalid IPTV Playlist record: ${record.id ?? '<unknown>'}.`);
  }
  return record;
}

function toChannel(record: ChannelRecord): Channel {
  if (
    typeof record.id !== 'string' ||
    typeof record.playlistId !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.streamUrl !== 'string'
  ) {
    throw new Error(`Invalid IPTV Channel record: ${record.id ?? '<unknown>'}.`);
  }
  return record;
}
