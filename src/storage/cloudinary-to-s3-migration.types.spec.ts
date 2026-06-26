import {
  buildLegacyStorageStats,
  isCloudinaryHttpUrl,
  isS3HttpUrl,
  resolveMigrationContentType,
} from './cloudinary-to-s3-migration.types';

describe('cloudinary-to-s3-migration.types', () => {
  it('detects cloudinary and s3 urls', () => {
    expect(
      isCloudinaryHttpUrl('https://res.cloudinary.com/demo/image/upload/v1/x.jpg'),
    ).toBe(true);
    expect(
      isS3HttpUrl(
        'https://bucket.s3.sa-east-1.amazonaws.com/quality/evidences/x.jpg',
      ),
    ).toBe(true);
  });

  it('buildLegacyStorageStats groups rows by provider', () => {
    const stats = buildLegacyStorageStats([
      {
        table: 'evidences',
        storageProvider: 'cloudinary',
        sourceUrl: 'https://res.cloudinary.com/demo/x.jpg',
      },
      {
        table: 'evidences',
        storageProvider: 's3',
        sourceUrl: 'https://bucket.s3.sa-east-1.amazonaws.com/x.jpg',
      },
      {
        table: 'signatures',
        storageProvider: 'cloudinary',
        sourceUrl: null,
      },
    ]);

    expect(stats.evidences.cloudinary).toBe(1);
    expect(stats.evidences.s3).toBe(1);
    expect(stats.signatures.missingUrl).toBe(1);
  });

  it('resolveMigrationContentType falls back to key extension', () => {
    expect(resolveMigrationContentType('quality/evidences/x.png')).toBe(
      'image/png',
    );
    expect(
      resolveMigrationContentType('quality/evidences/x.jpg', 'image/jpeg'),
    ).toBe('image/jpeg');
  });
});
