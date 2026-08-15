import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { ASSET_STORAGE, resolveStorageProvider } from './asset-storage.interface';
import { ASSET_STORAGE_REGISTRY, AssetStorageRegistry } from './asset-storage.registry';
import { CloudinaryAssetStorageAdapter } from './adapters/cloudinary-asset-storage.adapter';
import { LocalAssetStorageAdapter } from './adapters/local-asset-storage.adapter';
import { S3AssetStorageAdapter } from './adapters/s3-asset-storage.adapter';

@Module({
  imports: [CloudinaryModule],
  providers: [
    CloudinaryAssetStorageAdapter,
    S3AssetStorageAdapter,
    LocalAssetStorageAdapter,
    AssetStorageRegistry,
    {
      provide: ASSET_STORAGE,
      useFactory: (
        cloudinaryStorage: CloudinaryAssetStorageAdapter,
        s3Storage: S3AssetStorageAdapter,
        localStorage: LocalAssetStorageAdapter,
      ) => {
        const provider = resolveStorageProvider();
        if (provider === 's3') {
          return s3Storage;
        }
        if (provider === 'local') {
          return localStorage;
        }
        return cloudinaryStorage;
      },
      inject: [
        CloudinaryAssetStorageAdapter,
        S3AssetStorageAdapter,
        LocalAssetStorageAdapter,
      ],
    },
    {
      provide: ASSET_STORAGE_REGISTRY,
      useExisting: AssetStorageRegistry,
    },
  ],
  exports: [ASSET_STORAGE, ASSET_STORAGE_REGISTRY, AssetStorageRegistry],
})
export class StorageModule {}
