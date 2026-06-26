import { CloudinaryToS3MigrationService } from './cloudinary-to-s3-migration.service';

describe('CloudinaryToS3MigrationService', () => {
  it('migrates evidence rows from Cloudinary URL to S3', async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM evidences')) {
        return [
          {
            id: 'ev-1',
            source_url: 'https://res.cloudinary.com/demo/image/upload/v1/x.jpg',
            storage_key: 'quality/evidences/x.jpg',
            storage_provider: 'cloudinary',
          },
        ];
      }
      if (sql.startsWith('UPDATE evidences')) {
        expect(params).toEqual([
          'ev-1',
          's3',
          'quality/evidences/x.jpg',
          'sanorte-files-test',
          'https://sanorte-files-test.s3.sa-east-1.amazonaws.com/quality/evidences/x.jpg',
        ]);
        return [];
      }
      return [];
    });

    const dataSource = { query } as any;
    const s3Storage = {
      isConfigured: jest.fn().mockReturnValue(true),
      putObjectWithKey: jest.fn().mockResolvedValue({
        key: 'quality/evidences/x.jpg',
        url: 'https://sanorte-files-test.s3.sa-east-1.amazonaws.com/quality/evidences/x.jpg',
        bytes: 4,
      }),
      getBucketName: jest.fn().mockReturnValue('sanorte-files-test'),
    };

    const service = new CloudinaryToS3MigrationService(
      dataSource,
      s3Storage as any,
      async () => ({
        buffer: Buffer.from([1, 2, 3, 4]),
        contentType: 'image/jpeg',
      }),
    );

    const result = await service.run({
      tables: ['evidences'],
      batchSize: 10,
    });

    expect(result).toEqual({
      scanned: 1,
      migrated: 1,
      skipped: 0,
      failed: 0,
      failures: [],
    });
    expect(s3Storage.putObjectWithKey).toHaveBeenCalledWith(
      'quality/evidences/x.jpg',
      Buffer.from([1, 2, 3, 4]),
      'image/jpeg',
    );
  });

  it('supports dry-run without writing to S3 or database', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM signatures')) {
        return [
          {
            id: 'sig-1',
            source_url: 'https://res.cloudinary.com/demo/image/upload/v1/s.png',
            storage_key: 'quality/signatures/s.png',
            storage_provider: 'cloudinary',
          },
        ];
      }
      return [];
    });

    const s3Storage = {
      isConfigured: jest.fn().mockReturnValue(true),
      putObjectWithKey: jest.fn(),
      getBucketName: jest.fn().mockReturnValue('sanorte-files-test'),
    };

    const service = new CloudinaryToS3MigrationService(
      { query } as any,
      s3Storage as any,
      async () => ({
        buffer: Buffer.from('dry-run'),
        contentType: 'image/png',
      }),
    );

    const result = await service.run({
      tables: ['signatures'],
      dryRun: true,
    });

    expect(result.migrated).toBe(1);
    expect(s3Storage.putObjectWithKey).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
