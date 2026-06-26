import { AssetStorageRegistry } from './asset-storage.registry';
import { StorageProvider } from '../common/enums/storage-provider.enum';

describe('AssetStorageRegistry', () => {
  it('deleteStoredAsset should route to matching provider adapter', async () => {
    const cloudinaryStorage = { deleteAsset: jest.fn() };
    const s3Storage = { deleteAsset: jest.fn() };
    const registry = new AssetStorageRegistry(
      cloudinaryStorage as any,
      s3Storage as any,
    );

    await registry.deleteStoredAsset({
      storageProvider: StorageProvider.S3,
      storageKey: 'quality/evidences/x.jpg',
    });

    expect(s3Storage.deleteAsset).toHaveBeenCalledWith(
      'quality/evidences/x.jpg',
    );
    expect(cloudinaryStorage.deleteAsset).not.toHaveBeenCalled();
  });
});
