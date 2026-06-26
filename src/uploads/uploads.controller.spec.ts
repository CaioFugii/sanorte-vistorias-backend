import { UploadsController } from './uploads.controller';
import { AssetStorage } from '../storage/asset-storage.interface';

describe('UploadsController', () => {
  let controller: UploadsController;
  let assetStorage: jest.Mocked<AssetStorage>;

  beforeEach(() => {
    assetStorage = {
      uploadImageFromPath: jest.fn(),
      uploadImage: jest.fn(),
      deleteAsset: jest.fn(),
    };
    controller = new UploadsController(assetStorage);
  });

  it('should upload with default evidences folder and return metadata', async () => {
    assetStorage.uploadImageFromPath.mockResolvedValue({
      publicId: 'quality/evidences/asset-1',
      url: 'https://example-bucket.s3.sa-east-1.amazonaws.com/quality/evidences/asset-1.jpg',
      resourceType: 'image',
      bytes: 12345,
      format: 'jpg',
      width: 1024,
      height: 768,
    });

    const file = {
      path: '/tmp/sanorte-upload-test.jpg',
      mimetype: 'image/jpeg',
      size: 5,
      originalname: 'photo.jpg',
    } as Express.Multer.File;

    const result = await controller.upload(file);

    expect(assetStorage.uploadImageFromPath).toHaveBeenCalledWith(file.path, {
      folder: 'quality/evidences',
    });
    expect(result).toEqual({
      publicId: 'quality/evidences/asset-1',
      url: 'https://example-bucket.s3.sa-east-1.amazonaws.com/quality/evidences/asset-1.jpg',
      resourceType: 'image',
      bytes: 12345,
      format: 'jpg',
      width: 1024,
      height: 768,
    });
  });

  it('should map signatures alias folder', async () => {
    assetStorage.uploadImageFromPath.mockResolvedValue({
      publicId: 'quality/signatures/asset-2',
      url: 'https://example-bucket.s3.sa-east-1.amazonaws.com/quality/signatures/asset-2.png',
      resourceType: 'image',
      bytes: 999,
      format: 'png',
      width: 500,
      height: 200,
    });

    const file = {
      path: '/tmp/sanorte-upload-test.png',
      mimetype: 'image/png',
      size: 8,
      originalname: 'signature.png',
    } as Express.Multer.File;

    await controller.upload(file, 'signatures');

    expect(assetStorage.uploadImageFromPath).toHaveBeenCalledWith(file.path, {
      folder: 'quality/signatures',
    });
  });

  it('should delete a stored asset', async () => {
    assetStorage.deleteAsset.mockResolvedValue(undefined);

    const result = await controller.delete('quality%2Fevidences%2Fasset-1');

    expect(assetStorage.deleteAsset).toHaveBeenCalledWith(
      'quality/evidences/asset-1',
    );
    expect(result).toEqual({ ok: true });
  });
});
