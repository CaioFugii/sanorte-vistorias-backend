import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { InternalServerErrorException } from '@nestjs/common';
import { S3AssetStorageAdapter } from './s3-asset-storage.adapter';

const sendMock = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: jest.fn().mockImplementation((input) => input),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => input),
}));

jest.mock('fs/promises', () => ({
  stat: jest.fn().mockResolvedValue({ size: 2048 }),
}));

jest.mock('fs', () => ({
  createReadStream: jest.fn().mockReturnValue('mock-stream'),
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('test-uuid'),
}));

describe('S3AssetStorageAdapter', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AWS_REGION: 'sa-east-1',
      AWS_S3_BUCKET: 'sanorte-files-test',
      AWS_ACCESS_KEY_ID: 'AKIATEST',
      AWS_SECRET_ACCESS_KEY: 'secret-test',
    };
    sendMock.mockReset();
    sendMock.mockResolvedValue({});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('uploadImageFromPath should put object and return public URL', async () => {
    const adapter = new S3AssetStorageAdapter();
    const result = await adapter.uploadImageFromPath('/tmp/photo.jpg', {
      folder: 'quality/evidences',
    });

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'sanorte-files-test',
        Key: 'quality/evidences/test-uuid.jpg',
        ContentType: 'image/jpeg',
      }),
    );
    expect(result).toEqual({
      publicId: 'quality/evidences/test-uuid.jpg',
      url: 'https://sanorte-files-test.s3.sa-east-1.amazonaws.com/quality/evidences/test-uuid.jpg',
      resourceType: 'image',
      bytes: 2048,
      format: 'jpg',
      width: 0,
      height: 0,
    });
  });

  it('uploadImage should put buffer object', async () => {
    const adapter = new S3AssetStorageAdapter();
    const buffer = Buffer.from('fake-image');

    const result = await adapter.uploadImage(buffer, {
      folder: 'quality/signatures',
    });

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'sanorte-files-test',
        Key: 'quality/signatures/test-uuid.jpg',
        Body: buffer,
      }),
    );
    expect(result.publicId).toBe('quality/signatures/test-uuid.jpg');
  });

  it('deleteAsset should send DeleteObjectCommand', async () => {
    const adapter = new S3AssetStorageAdapter();
    await adapter.deleteAsset('quality/evidences/test-uuid.jpg');

    expect(DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: 'sanorte-files-test',
      Key: 'quality/evidences/test-uuid.jpg',
    });
  });

  it('should throw when S3 is not configured', async () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    const adapter = new S3AssetStorageAdapter();

    await expect(
      adapter.uploadImageFromPath('/tmp/photo.jpg'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
