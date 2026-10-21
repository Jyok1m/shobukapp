import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import type { Readable } from 'node:stream';

export type AllowedMime =
  'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

// The browser-provided mime type is never trusted: docs/documents.md.
export function sniffMime(buffer: Buffer): AllowedMime | null {
  if (buffer.subarray(0, 4).toString('latin1') === '%PDF') {
    return 'application/pdf';
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

// Same answer from src/ (ts-jest, ts-node) and from dist/src/ (build).
function apiRoot(): string {
  let dir = __dirname;
  while (!existsSync(join(dir, 'nest-cli.json'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('apps/api root not found');
    dir = parent;
  }
  return dir;
}

// Local disk driver for the MVP. Keys are random uuids, never a filename.
@Injectable()
export class StorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    // Relative to apps/api, not to the directory the API was started from.
    this.root = resolve(apiRoot(), config.getOrThrow<string>('storageDir'));
  }

  async put(buffer: Buffer): Promise<string> {
    await mkdir(this.root, { recursive: true });
    const key = randomUUID();
    await writeFile(this.path(key), buffer, { flag: 'wx' });
    return key;
  }

  async get(key: string): Promise<Readable> {
    const path = this.path(key);
    try {
      await stat(path);
    } catch {
      throw new NotFoundException({ code: 'not_found' });
    }
    return createReadStream(path);
  }

  async read(key: string): Promise<Buffer> {
    try {
      return await readFile(this.path(key));
    } catch {
      throw new NotFoundException({ code: 'not_found' });
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  private path(key: string): string {
    if (!/^[0-9a-f-]{36}$/.test(key)) throw new Error('Invalid storage key');
    return resolve(this.root, key);
  }
}
