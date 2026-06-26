import { DataSource } from 'typeorm';
import { typeormConfig } from '../../config/typeorm.config';
import { S3AssetStorageAdapter } from '../../storage/adapters/s3-asset-storage.adapter';
import {
  CloudinaryToS3MigrationService,
  summarizeMigrationFailures,
} from '../../storage/cloudinary-to-s3-migration.service';
import { LegacyStorageTable } from '../../storage/cloudinary-to-s3-migration.types';

type CliOptions = {
  dryRun: boolean;
  limit?: number;
  batchSize: number;
  tables: LegacyStorageTable[];
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    batchSize: 25,
    tables: ['evidences', 'signatures', 'checklist_items'],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--limit') {
      options.limit = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--batch-size') {
      options.batchSize = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--tables') {
      options.tables = argv[index + 1]
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean) as LegacyStorageTable[];
      index += 1;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dataSource = new DataSource(typeormConfig);
  await dataSource.initialize();

  try {
    const migration = new CloudinaryToS3MigrationService(
      dataSource,
      new S3AssetStorageAdapter(),
    );
    const result = await migration.run(options);

    console.log(
      JSON.stringify(
        {
          dryRun: options.dryRun,
          tables: options.tables,
          scanned: result.scanned,
          migrated: result.migrated,
          skipped: result.skipped,
          failed: result.failed,
          failures: summarizeMigrationFailures(result.failures),
        },
        null,
        2,
      ),
    );

    if (result.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Cloudinary -> S3 migration failed:', error);
  process.exit(1);
});
