import { MigrationInterface, QueryRunner } from 'typeorm';

export class InspectionItemResolutionColumns1700000003000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inspection_items"
      ADD COLUMN "resolved_at" TIMESTAMP,
      ADD COLUMN "resolved_by_user_id" uuid,
      ADD COLUMN "resolution_notes" text,
      ADD COLUMN "resolution_evidence_path" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "inspection_items"
      ADD CONSTRAINT "FK_inspection_items_resolved_by"
      FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inspection_items"
      DROP CONSTRAINT IF EXISTS "FK_inspection_items_resolved_by"
    `);

    await queryRunner.query(`
      ALTER TABLE "inspection_items"
      DROP COLUMN IF EXISTS "resolved_at",
      DROP COLUMN IF EXISTS "resolved_by_user_id",
      DROP COLUMN IF EXISTS "resolution_notes",
      DROP COLUMN IF EXISTS "resolution_evidence_path"
    `);
  }
}
