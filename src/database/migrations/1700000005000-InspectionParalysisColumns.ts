import { MigrationInterface, QueryRunner } from 'typeorm';

export class InspectionParalysisColumns1700000005000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD COLUMN "has_paralysis_penalty" boolean NOT NULL DEFAULT false,
      ADD COLUMN "paralyzed_reason" text,
      ADD COLUMN "paralyzed_at" TIMESTAMP,
      ADD COLUMN "paralyzed_by_user_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD CONSTRAINT "FK_inspections_paralyzed_by_user"
      FOREIGN KEY ("paralyzed_by_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inspections"
      DROP CONSTRAINT IF EXISTS "FK_inspections_paralyzed_by_user"
    `);

    await queryRunner.query(`
      ALTER TABLE "inspections"
      DROP COLUMN IF EXISTS "paralyzed_by_user_id",
      DROP COLUMN IF EXISTS "paralyzed_at",
      DROP COLUMN IF EXISTS "paralyzed_reason",
      DROP COLUMN IF EXISTS "has_paralysis_penalty"
    `);
  }
}
