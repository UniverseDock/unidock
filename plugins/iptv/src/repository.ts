import type { Channel, ChannelQuery, ParsePlaylistResult, Playlist } from './model.js';

export interface IPTVRepository {
  getPlaylist(id: string): Promise<Playlist | undefined>;
  listPlaylists(): Promise<Playlist[]>;
  getChannel(id: string): Promise<Channel | undefined>;
  listChannels(query?: ChannelQuery): Promise<Channel[]>;
  replacePlaylist(result: ParsePlaylistResult): Promise<void>;
  deletePlaylist(id: string): Promise<void>;
}
