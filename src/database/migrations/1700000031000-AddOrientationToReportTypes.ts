import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrientationToReportTypes1700000031000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_orientation_enum') THEN
          CREATE TYPE "report_orientation_enum" AS ENUM ('RETRATO', 'PAISAGEM');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "report_types"
      ADD COLUMN IF NOT EXISTS "orientation" "report_orientation_enum" NOT NULL DEFAULT 'RETRATO'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "report_types"
      DROP COLUMN IF EXISTS "orientation"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "report_orientation_enum"
    `);
  }
}
