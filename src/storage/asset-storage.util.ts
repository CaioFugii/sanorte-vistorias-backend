import { StorageProvider } from '../common/enums/storage-provider.enum';
import { AssetUploadResult, resolveStorageProvider } from './asset-storage.interface';

export type StoredAssetRecord = {
  storageProvider?: string | null;
  storageKey?: string | null;
  cloudinaryPublicId?: string | null;
  referenceImagePublicId?: string | null;
  referenceImageStorageKey?: string | null;
};

export function buildStoredAssetFields(uploaded: AssetUploadResult): {
  cloudinaryPublicId: string;
  storageProvider: StorageProvider;
  storageKey: string;
  storageBucket: string | null;
  url: string;
} {
  const provider = resolveStorageProvider();
  return {
    cloudinaryPublicId: uploaded.publicId,
    storageProvider:
      provider === StorageProvider.S3
        ? StorageProvider.S3
        : StorageProvider.CLOUDINARY,
    storageKey: uploaded.publicId,
    storageBucket:
      provider === StorageProvider.S3
        ? process.env.AWS_S3_BUCKET?.trim() || null
        : null,
    url: uploaded.url,
  };
}

export function resolveStoredAssetId(record: StoredAssetRecord): string | null {
  const key =
    record.storageKey?.trim() ||
    record.cloudinaryPublicId?.trim() ||
    record.referenceImageStorageKey?.trim() ||
    record.referenceImagePublicId?.trim();
  return key || null;
}

export function resolveStoredAssetProvider(
  record: StoredAssetRecord,
): StorageProvider {
  const provider = record.storageProvider?.trim().toLowerCase();
  if (provider === StorageProvider.S3) {
    return StorageProvider.S3;
  }
  if (provider === StorageProvider.CLOUDINARY) {
    return StorageProvider.CLOUDINARY;
  }
  return StorageProvider.CLOUDINARY;
}

export function inferStorageProviderFromUrl(
  url?: string | null,
): StorageProvider {
  const normalized = url?.trim().toLowerCase() || '';
  if (
    normalized.includes('amazonaws.com') ||
    normalized.includes('cloudfront.net')
  ) {
    return StorageProvider.S3;
  }
  if (normalized.includes('cloudinary.com')) {
    return StorageProvider.CLOUDINARY;
  }
  return StorageProvider.CLOUDINARY;
}

export function buildSyncedAssetFields(params: {
  url?: string | null;
  publicId?: string | null;
}): {
  cloudinaryPublicId: string | null;
  storageProvider: StorageProvider;
  storageKey: string | null;
  storageBucket: string | null;
} {
  const storageKey = params.publicId?.trim() || null;
  const storageProvider = inferStorageProviderFromUrl(params.url);
  return {
    cloudinaryPublicId: storageKey,
    storageProvider,
    storageKey,
    storageBucket:
      storageProvider === StorageProvider.S3
        ? process.env.AWS_S3_BUCKET?.trim() || null
        : null,
  };
}
