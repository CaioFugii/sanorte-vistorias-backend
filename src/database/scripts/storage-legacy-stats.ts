import { DataSource } from 'typeorm';
import { typeormConfig } from '../../config/typeorm.config';
import { collectLegacyStorageRows } from '../../storage/cloudinary-to-s3-migration.service';
import { buildLegacyStorageStats } from '../../storage/cloudinary-to-s3-migration.types';

async function main() {
  const dataSource = new DataSource(typeormConfig);
  await dataSource.initialize();

  try {
    const rows = await collectLegacyStorageRows(dataSource);
    const stats = buildLegacyStorageStats(rows);
    const cloudinaryTotal =
      stats.evidences.cloudinary +
      stats.signatures.cloudinary +
      stats.checklist_items.cloudinary;

    console.log(
      JSON.stringify(
        {
          totals: {
            assetsWithReference: rows.length,
            cloudinaryPendingMigration: cloudinaryTotal,
          },
          byTable: stats,
        },
        null,
        2,
      ),
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Legacy storage stats failed:', error);
  process.exit(1);
});
