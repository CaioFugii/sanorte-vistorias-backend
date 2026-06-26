import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { ASSET_STORAGE, resolveStorageProvider } from './asset-storage.interface';
import { ASSET_STORAGE_REGISTRY, AssetStorageRegistry } from './asset-storage.registry';
import { CloudinaryAssetStorageAdapter } from './adapters/cloudinary-asset-storage.adapter';
import { S3AssetStorageAdapter } from './adapters/s3-asset-storage.adapter';

@Module({
  imports: [CloudinaryModule],
  providers: [
    CloudinaryAssetStorageAdapter,
    S3AssetStorageAdapter,
    AssetStorageRegistry,
    {
      provide: ASSET_STORAGE,
      useFactory: (
        cloudinaryStorage: CloudinaryAssetStorageAdapter,
        s3Storage: S3AssetStorageAdapter,
      ) => {
        return resolveStorageProvider() === 's3'
          ? s3Storage
          : cloudinaryStorage;
      },
      inject: [CloudinaryAssetStorageAdapter, S3AssetStorageAdapter],
    },
    {
      provide: ASSET_STORAGE_REGISTRY,
      useExisting: AssetStorageRegistry,
    },
  ],
  exports: [ASSET_STORAGE, ASSET_STORAGE_REGISTRY, AssetStorageRegistry],
})
export class StorageModule {}
