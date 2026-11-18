import { MigrationInterface, QueryRunner } from 'typeorm';

export class TrackServiceOrderImportInserts1700000053000
  implements MigrationInterface
{
  name = 'TrackServiceOrderImportInserts1700000053000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "service_order_import_lines"
      ADD COLUMN "service_order_id" uuid,
      ADD COLUMN "created_new" boolean,
      ADD COLUMN "removed_at" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "service_order_import_lines"
      DROP COLUMN "removed_at",
      DROP COLUMN "created_new",
      DROP COLUMN "service_order_id"
    `);
  }
}
