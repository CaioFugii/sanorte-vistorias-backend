import { MigrationInterface, QueryRunner } from 'typeorm';

export class CloudinaryAssetsColumns1700000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "evidences"
      ADD COLUMN "cloudinary_public_id" character varying,
      ADD COLUMN "url" character varying,
      ADD COLUMN "bytes" integer,
      ADD COLUMN "format" character varying,
      ADD COLUMN "width" integer,
      ADD COLUMN "height" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "signatures"
      ADD COLUMN "cloudinary_public_id" character varying,
      ADD COLUMN "url" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "signatures"
      DROP COLUMN IF EXISTS "url",
      DROP COLUMN IF EXISTS "cloudinary_public_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "evidences"
      DROP COLUMN IF EXISTS "height",
      DROP COLUMN IF EXISTS "width",
      DROP COLUMN IF EXISTS "format",
      DROP COLUMN IF EXISTS "bytes",
      DROP COLUMN IF EXISTS "url",
      DROP COLUMN IF EXISTS "cloudinary_public_id"
    `);
  }
}
