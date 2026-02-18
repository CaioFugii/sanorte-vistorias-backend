import { UploadsController } from './uploads.controller';

describe('UploadsController', () => {
  let controller: UploadsController;
  let cloudinaryService: {
    uploadImage: jest.Mock;
    deleteAsset: jest.Mock;
  };

  beforeEach(() => {
    cloudinaryService = {
      uploadImage: jest.fn(),
      deleteAsset: jest.fn(),
    };
    controller = new UploadsController(cloudinaryService as any);
  });

  it('should upload with default evidences folder and return metadata', async () => {
    cloudinaryService.uploadImage.mockResolvedValue({
      public_id: 'quality/evidences/asset-1',
      secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/asset-1.jpg',
      resource_type: 'image',
      bytes: 12345,
      format: 'jpg',
      width: 1024,
      height: 768,
    });

    const file = {
      buffer: Buffer.from('image'),
      mimetype: 'image/jpeg',
      size: 5,
      originalname: 'photo.jpg',
    } as Express.Multer.File;

    const result = await controller.upload(file);

    expect(cloudinaryService.uploadImage).toHaveBeenCalledWith(file.buffer, {
      folder: 'quality/evidences',
    });
    expect(result).toEqual({
      publicId: 'quality/evidences/asset-1',
      url: 'https://res.cloudinary.com/demo/image/upload/v1/asset-1.jpg',
      resourceType: 'image',
      bytes: 12345,
      format: 'jpg',
      width: 1024,
      height: 768,
    });
  });

  it('should map signatures alias folder', async () => {
    cloudinaryService.uploadImage.mockResolvedValue({
      public_id: 'quality/signatures/asset-2',
      secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/asset-2.png',
      resource_type: 'image',
      bytes: 999,
      format: 'png',
      width: 500,
      height: 200,
    });

    const file = {
      buffer: Buffer.from('image'),
      mimetype: 'image/png',
      size: 8,
      originalname: 'signature.png',
    } as Express.Multer.File;

    await controller.upload(file, 'signatures');

    expect(cloudinaryService.uploadImage).toHaveBeenCalledWith(file.buffer, {
      folder: 'quality/signatures',
    });
  });

  it('should delete a cloudinary asset', async () => {
    cloudinaryService.deleteAsset.mockResolvedValue({ result: 'ok' });

    const result = await controller.delete('quality%2Fevidences%2Fasset-1');

    expect(cloudinaryService.deleteAsset).toHaveBeenCalledWith('quality/evidences/asset-1');
    expect(result).toEqual({ ok: true });
  });
});
