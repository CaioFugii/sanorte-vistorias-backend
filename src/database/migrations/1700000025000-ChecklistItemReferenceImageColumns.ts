import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChecklistItemReferenceImageColumns1700000025000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "checklist_items"
      ADD COLUMN "reference_image_url" character varying,
      ADD COLUMN "reference_image_public_id" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "checklist_items"
      DROP COLUMN IF EXISTS "reference_image_public_id",
      DROP COLUMN IF EXISTS "reference_image_url"
    `);
  }
}
