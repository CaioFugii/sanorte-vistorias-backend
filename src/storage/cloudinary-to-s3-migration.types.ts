import { StorageProvider } from '../common/enums/storage-provider.enum';

export type LegacyStorageTable =
  | 'evidences'
  | 'signatures'
  | 'checklist_items';

export type CloudinaryToS3MigrationOptions = {
  dryRun?: boolean;
  limit?: number;
  batchSize?: number;
  tables?: LegacyStorageTable[];
};

export type CloudinaryToS3MigrationFailure = {
  table: LegacyStorageTable;
  id: string;
  reason: string;
};

export type CloudinaryToS3MigrationResult = {
  scanned: number;
  migrated: number;
  skipped: number;
  failed: number;
  failures: CloudinaryToS3MigrationFailure[];
};

export type LegacyStorageStats = Record<
  LegacyStorageTable,
  {
    cloudinary: number;
    s3: number;
    other: number;
    missingUrl: number;
  }
>;

export type LegacyStorageCandidate = {
  table: LegacyStorageTable;
  id: string;
  sourceUrl: string;
  storageKey: string;
};

export function isCloudinaryHttpUrl(url?: string | null): boolean {
  return url?.trim().toLowerCase().includes('cloudinary.com') ?? false;
}

export function isS3HttpUrl(url?: string | null): boolean {
  const normalized = url?.trim().toLowerCase() || '';
  return (
    normalized.includes('amazonaws.com') || normalized.includes('cloudfront.net')
  );
}

export function resolveMigrationContentType(
  storageKey: string,
  headerValue?: string | null,
): string {
  const header = headerValue?.split(';')[0]?.trim().toLowerCase();
  if (header?.startsWith('image/')) {
    return header;
  }

  const ext = storageKey.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    default:
      return 'image/jpeg';
  }
}

export function buildLegacyStorageStats(
  rows: Array<{
    table: LegacyStorageTable;
    storageProvider?: string | null;
    sourceUrl?: string | null;
  }>,
): LegacyStorageStats {
  const stats: LegacyStorageStats = {
    evidences: { cloudinary: 0, s3: 0, other: 0, missingUrl: 0 },
    signatures: { cloudinary: 0, s3: 0, other: 0, missingUrl: 0 },
    checklist_items: { cloudinary: 0, s3: 0, other: 0, missingUrl: 0 },
  };

  for (const row of rows) {
    const bucket = stats[row.table];
    const provider = row.storageProvider?.trim().toLowerCase();
    const sourceUrl = row.sourceUrl?.trim();

    if (!sourceUrl) {
      bucket.missingUrl += 1;
      continue;
    }

    if (provider === StorageProvider.S3 || isS3HttpUrl(sourceUrl)) {
      bucket.s3 += 1;
      continue;
    }

    if (
      provider === StorageProvider.CLOUDINARY ||
      isCloudinaryHttpUrl(sourceUrl)
    ) {
      bucket.cloudinary += 1;
      continue;
    }

    bucket.other += 1;
  }

  return stats;
}
