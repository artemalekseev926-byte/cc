import { createReadStream, promises as fs } from 'node:fs';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { protocol } from 'electron';
import { ASSET_SCHEME } from '../shared/ipc';
import { parseRange } from '../shared/range';
import type { ThemeStore } from './storage';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.json': 'application/json',
};

export function registerSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: ASSET_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
  ]);
}

export function handleThemeProtocol(store: ThemeStore): void {
  protocol.handle(ASSET_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'theme') return new Response('Not found', { status: 404 });
    const [, rawId, ...rest] = url.pathname.split('/');
    const id = decodeURIComponent(rawId ?? '');
    const file = store.resolveThemeFile(id, rest.map(decodeURIComponent).join('/'));
    if (!file) return new Response('Not found', { status: 404 });

    const stat = await fs.stat(file).catch(() => null);
    if (!stat?.isFile()) return new Response('Not found', { status: 404 });
    const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
    const range = parseRange(request.headers.get('range'), stat.size);

    if (range) {
      const stream = createReadStream(file, { start: range.start, end: range.end });
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          'Content-Type': type,
          'Content-Length': String(range.end - range.start + 1),
          'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
        },
      });
    }
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      status: 200,
      headers: { 'Content-Type': type, 'Content-Length': String(stat.size), 'Accept-Ranges': 'bytes' },
    });
  });
}
