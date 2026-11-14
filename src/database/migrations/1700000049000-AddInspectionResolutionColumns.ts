import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInspectionResolutionColumns1700000049000
  implements MigrationInterface
{
  name = 'AddInspectionResolutionColumns1700000049000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "inspection_status_enum" ADD VALUE IF NOT EXISTS 'AGUARDANDO_APROVACAO'
    `);

    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD COLUMN "generate_pending" boolean
    `);
    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD COLUMN "resolution_submitted_by_user_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD COLUMN "resolution_submitted_at" TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD COLUMN "resolution_rejection_reason" text
    `);
    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD COLUMN "resolution_rejected_at" TIMESTAMP
    `);
    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD COLUMN "resolution_rejected_by_user_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD CONSTRAINT "FK_inspections_resolution_submitted_by"
      FOREIGN KEY ("resolution_submitted_by_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD CONSTRAINT "FK_inspections_resolution_rejected_by"
      FOREIGN KEY ("resolution_rejected_by_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inspections" DROP CONSTRAINT IF EXISTS "FK_inspections_resolution_rejected_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "inspections" DROP CONSTRAINT IF EXISTS "FK_inspections_resolution_submitted_by"
    `);
    await queryRunner.query(`
      ALTER TABLE "inspections" DROP COLUMN IF EXISTS "resolution_rejected_by_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "inspections" DROP COLUMN IF EXISTS "resolution_rejected_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "inspections" DROP COLUMN IF EXISTS "resolution_rejection_reason"
    `);
    await queryRunner.query(`
      ALTER TABLE "inspections" DROP COLUMN IF EXISTS "resolution_submitted_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "inspections" DROP COLUMN IF EXISTS "resolution_submitted_by_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "inspections" DROP COLUMN IF EXISTS "generate_pending"
    `);
  }
}
