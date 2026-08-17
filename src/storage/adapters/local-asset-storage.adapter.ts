import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import * as path from 'path';
import {
  AssetStorage,
  AssetUploadOptions,
  AssetUploadResult,
  DirectUploadDescriptor,
  DirectUploadOptions,
  StoredObjectStat,
} from '../asset-storage.interface';

export function getLocalStorageRoot(): string {
  return path.resolve(process.env.STORAGE_PATH || './storage');
}

export function getPublicApiBaseUrl(): string {
  return (
    process.env.PUBLIC_API_URL?.trim() ||
    `http://localhost:${process.env.PORT || 3000}`
  ).replace(/\/$/, '');
}

export function resolveSafeLocalPath(
  storageRoot: string,
  relativeKey: string,
): string {
  const normalized = relativeKey.replace(/^\/+/, '').replace(/\\/g, '/');
  if (!normalized || normalized.includes('..')) {
    throw new InternalServerErrorException('Invalid storage key');
  }

  const root = path.resolve(storageRoot);
  const fullPath = path.resolve(root, normalized);
  const relative = path.relative(root, fullPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new InternalServerErrorException('Invalid storage key');
  }
  return fullPath;
}

@Injectable()
export class LocalAssetStorageAdapter implements AssetStorage {
  private readonly logger = new Logger(LocalAssetStorageAdapter.name);
  private readonly storageRoot: string;
  private readonly publicBaseUrl: string;

  constructor() {
    this.storageRoot = getLocalStorageRoot();
    this.publicBaseUrl = getPublicApiBaseUrl();
  }

  async uploadImageFromPath(
    filePath: string,
    options: AssetUploadOptions = {},
  ): Promise<AssetUploadResult> {
    const buffer = await readFile(filePath);
    const ext = this.resolveExtension(filePath);
    return this.writeBuffer(buffer, ext, options);
  }

  async uploadImage(
    buffer: Buffer,
    options: AssetUploadOptions = {},
  ): Promise<AssetUploadResult> {
    return this.writeBuffer(buffer, 'jpg', options);
  }

  async createDirectUpload(
    _options: DirectUploadOptions,
  ): Promise<DirectUploadDescriptor> {
    return { mode: 'proxy' };
  }

  getPublicUrl(storageKey: string): string | null {
    const key = storageKey.trim();
    if (!key) {
      return null;
    }
    return `${this.publicBaseUrl}/files/${key}`;
  }

  async statObject(_storageKey: string): Promise<StoredObjectStat | null> {
    return null;
  }

  async deleteAsset(assetId: string): Promise<void> {
    const key = assetId.trim();
    if (!key) {
      return;
    }

    const fullPath = resolveSafeLocalPath(this.storageRoot, key);
    await unlink(fullPath).catch(() => undefined);
    this.logger.log(`Deleted local object key=${key}`);
  }

  private async writeBuffer(
    buffer: Buffer,
    ext: string,
    options: AssetUploadOptions,
  ): Promise<AssetUploadResult> {
    const folder = (options.folder || 'quality/evidences').replace(/^\/+|\/+$/g, '');
    const key = `${folder}/${randomUUID()}.${ext}`;
    const fullPath = resolveSafeLocalPath(this.storageRoot, key);

    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);

    this.logger.log(`Wrote local object key=${key} bytes=${buffer.length}`);

    return {
      publicId: key,
      url: `${this.publicBaseUrl}/files/${key}`,
      resourceType: 'image',
      bytes: buffer.length,
      format: ext,
      width: 0,
      height: 0,
    };
  }

  private resolveExtension(filePath: string): string {
    const ext = path.extname(filePath).replace(/^\./, '').toLowerCase();
    return ext || 'jpg';
  }
}
