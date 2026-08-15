import { Injectable } from '@nestjs/common';
import { StorageProvider } from '../common/enums/storage-provider.enum';
import { AssetStorage } from './asset-storage.interface';
import { CloudinaryAssetStorageAdapter } from './adapters/cloudinary-asset-storage.adapter';
import { LocalAssetStorageAdapter } from './adapters/local-asset-storage.adapter';
import { S3AssetStorageAdapter } from './adapters/s3-asset-storage.adapter';
import {
  resolveStoredAssetId,
  resolveStoredAssetProvider,
  StoredAssetRecord,
} from './asset-storage.util';

export const ASSET_STORAGE_REGISTRY = Symbol('ASSET_STORAGE_REGISTRY');

@Injectable()
export class AssetStorageRegistry {
  constructor(
    private readonly cloudinaryStorage: CloudinaryAssetStorageAdapter,
    private readonly s3Storage: S3AssetStorageAdapter,
    private readonly localStorage: LocalAssetStorageAdapter,
  ) {}

  getForProvider(provider: StorageProvider): AssetStorage {
    if (provider === StorageProvider.S3) {
      return this.s3Storage;
    }
    if (provider === StorageProvider.LOCAL) {
      return this.localStorage;
    }
    return this.cloudinaryStorage;
  }

  async deleteStoredAsset(record: StoredAssetRecord): Promise<void> {
    const assetId = resolveStoredAssetId(record);
    if (!assetId) {
      return;
    }

    const provider = resolveStoredAssetProvider(record);
    await this.getForProvider(provider).deleteAsset(assetId);
  }
}
