import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStorageProviderColumns1700000037000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "evidences"
      ADD COLUMN "storage_provider" character varying,
      ADD COLUMN "storage_key" character varying,
      ADD COLUMN "storage_bucket" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "signatures"
      ADD COLUMN "storage_provider" character varying,
      ADD COLUMN "storage_key" character varying,
      ADD COLUMN "storage_bucket" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "checklist_items"
      ADD COLUMN "reference_image_storage_provider" character varying,
      ADD COLUMN "reference_image_storage_key" character varying,
      ADD COLUMN "reference_image_storage_bucket" character varying
    `);

    await queryRunner.query(`
      UPDATE "evidences"
      SET
        "storage_provider" = 'cloudinary',
        "storage_key" = "cloudinary_public_id"
      WHERE "cloudinary_public_id" IS NOT NULL
        AND TRIM("cloudinary_public_id") <> ''
    `);

    await queryRunner.query(`
      UPDATE "signatures"
      SET
        "storage_provider" = 'cloudinary',
        "storage_key" = "cloudinary_public_id"
      WHERE "cloudinary_public_id" IS NOT NULL
        AND TRIM("cloudinary_public_id") <> ''
    `);

    await queryRunner.query(`
      UPDATE "checklist_items"
      SET
        "reference_image_storage_provider" = 'cloudinary',
        "reference_image_storage_key" = "reference_image_public_id"
      WHERE "reference_image_public_id" IS NOT NULL
        AND TRIM("reference_image_public_id") <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "checklist_items"
      DROP COLUMN IF EXISTS "reference_image_storage_bucket",
      DROP COLUMN IF EXISTS "reference_image_storage_key",
      DROP COLUMN IF EXISTS "reference_image_storage_provider"
    `);

    await queryRunner.query(`
      ALTER TABLE "signatures"
      DROP COLUMN IF EXISTS "storage_bucket",
      DROP COLUMN IF EXISTS "storage_key",
      DROP COLUMN IF EXISTS "storage_provider"
    `);

    await queryRunner.query(`
      ALTER TABLE "evidences"
      DROP COLUMN IF EXISTS "storage_bucket",
      DROP COLUMN IF EXISTS "storage_key",
      DROP COLUMN IF EXISTS "storage_provider"
    `);
  }
}
