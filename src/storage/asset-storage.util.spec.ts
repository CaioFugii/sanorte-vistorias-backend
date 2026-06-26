import { StorageProvider } from '../common/enums/storage-provider.enum';
import {
  buildStoredAssetFields,
  buildSyncedAssetFields,
  inferStorageProviderFromUrl,
  resolveStoredAssetId,
} from './asset-storage.util';

describe('asset-storage.util', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('buildStoredAssetFields should use active S3 provider', () => {
    process.env.STORAGE_PROVIDER = 's3';
    process.env.AWS_S3_BUCKET = 'sanorte-files-test';

    const fields = buildStoredAssetFields({
      publicId: 'quality/evidences/x.jpg',
      url: 'https://bucket.s3.sa-east-1.amazonaws.com/quality/evidences/x.jpg',
      resourceType: 'image',
      bytes: 100,
      format: 'jpg',
      width: 0,
      height: 0,
    });

    expect(fields).toEqual({
      cloudinaryPublicId: 'quality/evidences/x.jpg',
      storageProvider: StorageProvider.S3,
      storageKey: 'quality/evidences/x.jpg',
      storageBucket: 'sanorte-files-test',
      url: 'https://bucket.s3.sa-east-1.amazonaws.com/quality/evidences/x.jpg',
    });
  });

  it('buildSyncedAssetFields should infer provider from URL', () => {
    expect(
      inferStorageProviderFromUrl(
        'https://res.cloudinary.com/demo/image/upload/v1/x.jpg',
      ),
    ).toBe(StorageProvider.CLOUDINARY);

    expect(
      inferStorageProviderFromUrl(
        'https://bucket.s3.sa-east-1.amazonaws.com/quality/evidences/x.jpg',
      ),
    ).toBe(StorageProvider.S3);

    const synced = buildSyncedAssetFields({
      url: 'https://bucket.s3.sa-east-1.amazonaws.com/quality/evidences/x.jpg',
      publicId: 'quality/evidences/x.jpg',
    });

    expect(synced.storageProvider).toBe(StorageProvider.S3);
    expect(synced.storageKey).toBe('quality/evidences/x.jpg');
  });

  it('resolveStoredAssetId should prefer storageKey', () => {
    expect(
      resolveStoredAssetId({
        storageKey: 'quality/evidences/new.jpg',
        cloudinaryPublicId: 'legacy/id',
      }),
    ).toBe('quality/evidences/new.jpg');
  });
});
