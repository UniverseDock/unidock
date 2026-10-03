export interface Playlist {
  id: string;
  name: string;
  source?: string;
  updatedAt: number;
  lastError?: string;
}

export interface Channel {
  id: string;
  playlistId: string;
  name: string;
  group?: string;
  streamUrl: string;
  logo?: string;
  language?: string;
  country?: string;
}

export interface ParsePlaylistOptions {
  playlistId: string;
  playlistName: string;
  source?: string;
  updatedAt?: number;
}

export type PlaylistDiagnosticCode =
  | 'missing-name'
  | 'missing-url'
  | 'invalid-url'
  | 'duplicate-channel';

export interface PlaylistDiagnostic {
  code: PlaylistDiagnosticCode;
  line: number;
  message: string;
  value?: string;
}

export interface ParsePlaylistResult {
  playlist: Playlist;
  channels: Channel[];
  diagnostics: PlaylistDiagnostic[];
}

export interface ChannelQuery {
  playlistId?: string;
  group?: string;
  limit?: number;
  offset?: number;
}
