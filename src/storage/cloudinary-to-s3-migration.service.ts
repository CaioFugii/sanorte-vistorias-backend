import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StorageProvider } from '../common/enums/storage-provider.enum';
import { S3AssetStorageAdapter } from './adapters/s3-asset-storage.adapter';
import {
  CloudinaryToS3MigrationFailure,
  CloudinaryToS3MigrationOptions,
  CloudinaryToS3MigrationResult,
  isCloudinaryHttpUrl,
  isS3HttpUrl,
  LegacyStorageCandidate,
  LegacyStorageTable,
  resolveMigrationContentType,
} from './cloudinary-to-s3-migration.types';

const DEFAULT_TABLES: LegacyStorageTable[] = [
  'evidences',
  'signatures',
  'checklist_items',
];

export class CloudinaryToS3MigrationService {
  private readonly logger = new Logger(CloudinaryToS3MigrationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly s3Storage: S3AssetStorageAdapter,
    private readonly downloadAsset: (
      url: string,
    ) => Promise<{ buffer: Buffer; contentType?: string | null }> = defaultDownloadAsset,
  ) {}

  async run(
    options: CloudinaryToS3MigrationOptions = {},
  ): Promise<CloudinaryToS3MigrationResult> {
    if (!this.s3Storage.isConfigured()) {
      throw new Error(
        'S3 is not configured (AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)',
      );
    }

    const tables = options.tables?.length ? options.tables : DEFAULT_TABLES;
    const batchSize = Math.max(1, options.batchSize ?? 25);
    const limit = options.limit && options.limit > 0 ? options.limit : undefined;
    const dryRun = options.dryRun === true;

    const result: CloudinaryToS3MigrationResult = {
      scanned: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
      failures: [],
    };

    for (const table of tables) {
      let offset = 0;
      while (true) {
        if (limit !== undefined && result.scanned >= limit) {
          break;
        }

        const remaining =
          limit !== undefined ? Math.max(limit - result.scanned, 0) : batchSize;
        const take = limit !== undefined ? Math.min(batchSize, remaining) : batchSize;
        if (take <= 0) {
          break;
        }

        const candidates = await this.fetchCandidates(table, take, offset);
        if (candidates.length === 0) {
          break;
        }

        for (const candidate of candidates) {
          if (limit !== undefined && result.scanned >= limit) {
            break;
          }

          result.scanned += 1;
          try {
            const migrated = await this.migrateCandidate(candidate, dryRun);
            if (migrated) {
              result.migrated += 1;
            } else {
              result.skipped += 1;
            }
          } catch (error) {
            result.failed += 1;
            result.failures.push({
              table: candidate.table,
              id: candidate.id,
              reason:
                error instanceof Error ? error.message : 'Unknown migration error',
            });
          }
        }

        offset += candidates.length;
        if (candidates.length < take) {
          break;
        }
      }
    }

    this.logger.log(
      `Migration finished scanned=${result.scanned} migrated=${result.migrated} skipped=${result.skipped} failed=${result.failed} dryRun=${dryRun}`,
    );

    return result;
  }

  private async fetchCandidates(
    table: LegacyStorageTable,
    take: number,
    offset: number,
  ): Promise<LegacyStorageCandidate[]> {
    switch (table) {
      case 'evidences':
        return this.fetchEvidenceCandidates(take, offset);
      case 'signatures':
        return this.fetchSignatureCandidates(take, offset);
      case 'checklist_items':
        return this.fetchChecklistItemCandidates(take, offset);
      default:
        return [];
    }
  }

  private async fetchEvidenceCandidates(
    take: number,
    offset: number,
  ): Promise<LegacyStorageCandidate[]> {
    const rows = await this.dataSource.query(
      `
        SELECT
          id,
          COALESCE(NULLIF(TRIM(url), ''), NULLIF(TRIM(file_path), '')) AS source_url,
          COALESCE(NULLIF(TRIM(storage_key), ''), NULLIF(TRIM(cloudinary_public_id), '')) AS storage_key,
          storage_provider
        FROM evidences
        WHERE COALESCE(storage_provider, 'cloudinary') = $1
        ORDER BY created_at ASC
        LIMIT $2 OFFSET $3
      `,
      [StorageProvider.CLOUDINARY, take, offset],
    );

    return rows
      .map((row: any) => ({
        table: 'evidences' as const,
        id: row.id,
        sourceUrl: row.source_url,
        storageKey: row.storage_key,
        storageProvider: row.storage_provider,
      }))
      .filter((row) => this.isMigratableCandidate(row))
      .map(({ table, id, sourceUrl, storageKey }) => ({
        table,
        id,
        sourceUrl,
        storageKey,
      }));
  }

  private async fetchSignatureCandidates(
    take: number,
    offset: number,
  ): Promise<LegacyStorageCandidate[]> {
    const rows = await this.dataSource.query(
      `
        SELECT
          id,
          COALESCE(NULLIF(TRIM(url), ''), NULLIF(TRIM(image_path), '')) AS source_url,
          COALESCE(NULLIF(TRIM(storage_key), ''), NULLIF(TRIM(cloudinary_public_id), '')) AS storage_key,
          storage_provider
        FROM signatures
        WHERE COALESCE(storage_provider, 'cloudinary') = $1
        ORDER BY signed_at ASC
        LIMIT $2 OFFSET $3
      `,
      [StorageProvider.CLOUDINARY, take, offset],
    );

    return rows
      .map((row: any) => ({
        table: 'signatures' as const,
        id: row.id,
        sourceUrl: row.source_url,
        storageKey: row.storage_key,
        storageProvider: row.storage_provider,
      }))
      .filter((row) => this.isMigratableCandidate(row))
      .map(({ table, id, sourceUrl, storageKey }) => ({
        table,
        id,
        sourceUrl,
        storageKey,
      }));
  }

  private async fetchChecklistItemCandidates(
    take: number,
    offset: number,
  ): Promise<LegacyStorageCandidate[]> {
    const rows = await this.dataSource.query(
      `
        SELECT
          id,
          NULLIF(TRIM(reference_image_url), '') AS source_url,
          COALESCE(
            NULLIF(TRIM(reference_image_storage_key), ''),
            NULLIF(TRIM(reference_image_public_id), '')
          ) AS storage_key,
          reference_image_storage_provider AS storage_provider
        FROM checklist_items
        WHERE COALESCE(reference_image_storage_provider, 'cloudinary') = $1
          AND reference_image_url IS NOT NULL
        ORDER BY id ASC
        LIMIT $2 OFFSET $3
      `,
      [StorageProvider.CLOUDINARY, take, offset],
    );

    return rows
      .map((row: any) => ({
        table: 'checklist_items' as const,
        id: row.id,
        sourceUrl: row.source_url,
        storageKey: row.storage_key,
        storageProvider: row.storage_provider,
      }))
      .filter((row) => this.isMigratableCandidate(row))
      .map(({ table, id, sourceUrl, storageKey }) => ({
        table,
        id,
        sourceUrl,
        storageKey,
      }));
  }

  private isMigratableCandidate(row: {
    sourceUrl?: string | null;
    storageKey?: string | null;
    storageProvider?: string | null;
  }): boolean {
    const sourceUrl = row.sourceUrl?.trim();
    const storageKey = row.storageKey?.trim();
    if (!sourceUrl || !storageKey) {
      return false;
    }

    if (isS3HttpUrl(sourceUrl)) {
      return false;
    }

    return (
      row.storageProvider?.trim().toLowerCase() === StorageProvider.CLOUDINARY ||
      isCloudinaryHttpUrl(sourceUrl)
    );
  }

  private async migrateCandidate(
    candidate: LegacyStorageCandidate,
    dryRun: boolean,
  ): Promise<boolean> {
    const { buffer, contentType } = await this.downloadAsset(candidate.sourceUrl);
    const resolvedContentType = resolveMigrationContentType(
      candidate.storageKey,
      contentType,
    );

    if (dryRun) {
      this.logger.log(
        `[dry-run] ${candidate.table}/${candidate.id} key=${candidate.storageKey} bytes=${buffer.length}`,
      );
      return true;
    }

    const uploaded = await this.s3Storage.putObjectWithKey(
      candidate.storageKey,
      buffer,
      resolvedContentType,
    );
    const bucket = this.s3Storage.getBucketName();

    switch (candidate.table) {
      case 'evidences':
        await this.dataSource.query(
          `
            UPDATE evidences
            SET
              storage_provider = $2,
              storage_key = $3,
              storage_bucket = $4,
              url = $5,
              file_path = $5,
              cloudinary_public_id = $3
            WHERE id = $1
          `,
          [
            candidate.id,
            StorageProvider.S3,
            uploaded.key,
            bucket,
            uploaded.url,
          ],
        );
        break;
      case 'signatures':
        await this.dataSource.query(
          `
            UPDATE signatures
            SET
              storage_provider = $2,
              storage_key = $3,
              storage_bucket = $4,
              url = $5,
              image_path = $5,
              cloudinary_public_id = $3
            WHERE id = $1
          `,
          [
            candidate.id,
            StorageProvider.S3,
            uploaded.key,
            bucket,
            uploaded.url,
          ],
        );
        break;
      case 'checklist_items':
        await this.dataSource.query(
          `
            UPDATE checklist_items
            SET
              reference_image_storage_provider = $2,
              reference_image_storage_key = $3,
              reference_image_storage_bucket = $4,
              reference_image_url = $5,
              reference_image_public_id = $3
            WHERE id = $1
          `,
          [
            candidate.id,
            StorageProvider.S3,
            uploaded.key,
            bucket,
            uploaded.url,
          ],
        );
        break;
    }

    this.logger.log(
      `Migrated ${candidate.table}/${candidate.id} -> ${uploaded.url}`,
    );
    return true;
  }
}

async function defaultDownloadAsset(
  url: string,
): Promise<{ buffer: Buffer; contentType?: string | null }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get('content-type'),
  };
}

export async function collectLegacyStorageRows(
  dataSource: DataSource,
): Promise<
  Array<{
    table: LegacyStorageTable;
    storageProvider?: string | null;
    sourceUrl?: string | null;
  }>
> {
  const [evidences, signatures, checklistItems] = await Promise.all([
    dataSource.query(`
      SELECT
        'evidences'::text AS table_name,
        storage_provider,
        COALESCE(NULLIF(TRIM(url), ''), NULLIF(TRIM(file_path), '')) AS source_url
      FROM evidences
      WHERE COALESCE(NULLIF(TRIM(storage_key), ''), NULLIF(TRIM(cloudinary_public_id), '')) IS NOT NULL
    `),
    dataSource.query(`
      SELECT
        'signatures'::text AS table_name,
        storage_provider,
        COALESCE(NULLIF(TRIM(url), ''), NULLIF(TRIM(image_path), '')) AS source_url
      FROM signatures
      WHERE COALESCE(NULLIF(TRIM(storage_key), ''), NULLIF(TRIM(cloudinary_public_id), '')) IS NOT NULL
    `),
    dataSource.query(`
      SELECT
        'checklist_items'::text AS table_name,
        reference_image_storage_provider AS storage_provider,
        NULLIF(TRIM(reference_image_url), '') AS source_url
      FROM checklist_items
      WHERE COALESCE(
        NULLIF(TRIM(reference_image_storage_key), ''),
        NULLIF(TRIM(reference_image_public_id), '')
      ) IS NOT NULL
    `),
  ]);

  return [...evidences, ...signatures, ...checklistItems].map((row: any) => ({
    table: row.table_name as LegacyStorageTable,
    storageProvider: row.storage_provider,
    sourceUrl: row.source_url,
  }));
}

export function summarizeMigrationFailures(
  failures: CloudinaryToS3MigrationFailure[],
  maxItems = 10,
): string[] {
  return failures.slice(0, maxItems).map(
    (failure) => `${failure.table}/${failure.id}: ${failure.reason}`,
  );
}
