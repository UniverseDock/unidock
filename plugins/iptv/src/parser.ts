import type {
  Channel,
  ParsePlaylistOptions,
  ParsePlaylistResult,
  PlaylistDiagnostic,
  PlaylistDiagnosticCode
} from './model.js';

interface PendingEntry {
  line: number;
  name?: string;
  group?: string;
  logo?: string;
  language?: string;
  country?: string;
}

const attributePattern = /([\w-]+)\s*=\s*"([^"]*)"/g;

export function parseM3U(text: string, options: ParsePlaylistOptions): ParsePlaylistResult {
  validateOptions(options);

  const diagnostics: PlaylistDiagnostic[] = [];
  const channels: Channel[] = [];
  const seenUrls = new Set<string>();
  let pending: PendingEntry | undefined;

  for (const [index, rawLine] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line || line === '#EXTM3U' || line.startsWith('#EXT-X-')) continue;

    if (line.startsWith('#EXTINF:')) {
      if (pending) {
        addDiagnostic(
          diagnostics,
          'missing-url',
          pending.line,
          `EXTINF at line ${pending.line} has no following stream URL.`
        );
      }
      pending = parseExtinf(line, lineNumber);
      continue;
    }

    if (line.startsWith('#')) continue;
    if (!pending) continue;

    const streamUrl = normalizeUrl(line);
    if (!streamUrl) {
      addDiagnostic(
        diagnostics,
        'invalid-url',
        lineNumber,
        `Unsupported stream URL at line ${lineNumber}; only HTTP(S) URLs are accepted.`,
        line
      );
      pending = undefined;
      continue;
    }

    if (!pending.name) {
      addDiagnostic(
        diagnostics,
        'missing-name',
        pending.line,
        `EXTINF at line ${pending.line} has no channel name.`,
        line
      );
      pending = undefined;
      continue;
    }

    if (seenUrls.has(streamUrl)) {
      addDiagnostic(
        diagnostics,
        'duplicate-channel',
        pending.line,
        `Duplicate channel URL was ignored: ${streamUrl}`,
        streamUrl
      );
      pending = undefined;
      continue;
    }

    seenUrls.add(streamUrl);
    channels.push(createChannel(options.playlistId, streamUrl, pending));
    pending = undefined;
  }

  if (pending) {
    addDiagnostic(
      diagnostics,
      'missing-url',
      pending.line,
      `EXTINF at line ${pending.line} has no following stream URL.`
    );
  }

  return {
    playlist: {
      id: options.playlistId,
      name: options.playlistName.trim(),
      ...(options.source ? { source: options.source } : {}),
      updatedAt: options.updatedAt ?? 0
    },
    channels,
    diagnostics
  };
}

function parseExtinf(line: string, lineNumber: number): PendingEntry {
  const comma = line.indexOf(',');
  const metadata = comma < 0 ? line : line.slice(0, comma);
  const name = comma < 0 ? undefined : line.slice(comma + 1).trim() || undefined;
  const attributes: Record<string, string> = {};

  for (const match of metadata.matchAll(attributePattern)) {
    const key = match[1];
    const value = match[2];
    if (key && value !== undefined) attributes[key] = value.trim();
  }

  return {
    line: lineNumber,
    name,
    group: attributes['group-title'] || undefined,
    logo: attributes['tvg-logo'] || undefined,
    language: attributes['tvg-language'] || undefined,
    country: attributes['tvg-country'] || undefined
  };
}

function createChannel(playlistId: string, streamUrl: string, entry: PendingEntry): Channel {
  return {
    id: `${playlistId}::${stableHash(streamUrl)}`,
    playlistId,
    name: entry.name as string,
    ...(entry.group ? { group: entry.group } : {}),
    streamUrl,
    ...(entry.logo ? { logo: entry.logo } : {}),
    ...(entry.language ? { language: entry.language } : {}),
    ...(entry.country ? { country: entry.country } : {})
  };
}

function normalizeUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function addDiagnostic(
  diagnostics: PlaylistDiagnostic[],
  code: PlaylistDiagnosticCode,
  line: number,
  message: string,
  value?: string
): void {
  diagnostics.push({ code, line, message, ...(value ? { value } : {}) });
}

function validateOptions(options: ParsePlaylistOptions): void {
  if (!options.playlistId.trim()) throw new Error('Playlist ID must not be empty.');
  if (!options.playlistName.trim()) throw new Error('Playlist name must not be empty.');
  if (options.source !== undefined) {
    try {
      new URL(options.source);
    } catch {
      throw new Error('Playlist source must be a valid URL.');
    }
  }
}
