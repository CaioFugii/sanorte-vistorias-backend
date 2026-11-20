import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import * as path from 'path';
import { StorageProvider } from '../enums';
import { S3AssetStorageAdapter } from '../../storage/adapters/s3-asset-storage.adapter';
import {
  getLocalStorageRoot,
  resolveSafeLocalPath,
} from '../../storage/adapters/local-asset-storage.adapter';
import { resolveStorageProvider } from '../../storage/asset-storage.interface';

@Injectable()
export class SpreadsheetStorageService {
  private readonly logger = new Logger(SpreadsheetStorageService.name);

  constructor(private readonly s3Storage: S3AssetStorageAdapter) {}

  async save(
    buffer: Buffer,
    originalName: string,
    keyPrefix: string,
  ): Promise<{ key: string; provider: string }> {
    const extension = this.extensionFor(originalName);
    const prefix = keyPrefix.replace(/^\/+|\/+$/g, '');
    const key = `${prefix}/${randomUUID()}.${extension}`;
    const provider = resolveStorageProvider();
    if (provider === 's3') {
      await this.s3Storage.putObjectWithKey(
        key,
        buffer,
        this.contentTypeFor(extension),
      );
      return { key, provider: StorageProvider.S3 };
    }

    if (provider !== 'local') {
      this.logger.warn(
        `STORAGE_PROVIDER=${provider} não recebe planilha. O arquivo foi gravado em disco.`,
      );
    }
    const fullPath = resolveSafeLocalPath(getLocalStorageRoot(), key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
    return { key, provider: StorageProvider.LOCAL };
  }

  async remove(key: string, provider: string): Promise<void> {
    if (provider === StorageProvider.S3) {
      await this.s3Storage.deleteAsset(key);
      return;
    }
    await rm(resolveSafeLocalPath(getLocalStorageRoot(), key), { force: true });
  }

  async read(key: string, provider: string): Promise<Buffer> {
    if (provider === StorageProvider.S3) {
      return this.s3Storage.getObjectBuffer(key);
    }
    return readFile(resolveSafeLocalPath(getLocalStorageRoot(), key));
  }

  contentTypeForName(fileName: string): string {
    return this.contentTypeFor(this.extensionFor(fileName));
  }

  private extensionFor(fileName: string): 'xls' | 'xlsx' {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.xls') && !lower.endsWith('.xlsx')) return 'xls';
    return 'xlsx';
  }

  private contentTypeFor(extension: 'xls' | 'xlsx'): string {
    return extension === 'xls'
      ? 'application/vnd.ms-excel'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
}
