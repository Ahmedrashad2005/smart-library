import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createReadStream, type ReadStream } from 'fs';
import { mkdir, open, stat, unlink } from 'fs/promises';
import { basename, resolve } from 'path';

const STORAGE_KEY = /^[0-9a-f-]{36}\.pdf$/i;

export type StoredBookPreview = {
  key: string;
  size: number;
  stream: ReadStream;
};

@Injectable()
export class BookAssetStorageService {
  readonly root = resolve(
    process.env.BOOK_PREVIEW_STORAGE_DIR ?? resolve(process.cwd(), 'uploads', 'books', 'previews'),
  );

  async store(contents: Buffer): Promise<string> {
    await mkdir(this.root, { recursive: true });
    const key = `${randomUUID()}.pdf`;
    const handle = await open(this.pathFor(key), 'wx', 0o600);
    try {
      await handle.writeFile(contents);
    } finally {
      await handle.close();
    }
    return key;
  }

  async retrieve(key: string): Promise<StoredBookPreview> {
    const filePath = this.pathFor(key);
    try {
      const details = await stat(filePath);
      if (!details.isFile()) throw new Error('Not a file');
      return { key, size: details.size, stream: createReadStream(filePath) };
    } catch {
      throw new NotFoundException('Book preview PDF is unavailable');
    }
  }

  async remove(key: string): Promise<void> {
    const filePath = this.pathFor(key);
    try {
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  private pathFor(key: string): string {
    if (!STORAGE_KEY.test(key) || basename(key) !== key) {
      throw new NotFoundException('Book preview PDF is unavailable');
    }
    const filePath = resolve(this.root, key);
    if (!filePath.startsWith(`${this.root}/`)) {
      throw new NotFoundException('Book preview PDF is unavailable');
    }
    return filePath;
  }
}
