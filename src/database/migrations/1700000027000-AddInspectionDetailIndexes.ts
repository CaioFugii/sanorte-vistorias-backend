import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInspectionDetailIndexes1700000027000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inspection_items_inspection_created_at"
      ON "inspection_items"("inspection_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_evidences_inspection_created_at"
      ON "evidences"("inspection_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_signatures_inspection_signed_at"
      ON "signatures"("inspection_id", "signed_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_checklist_items_checklist_id"
      ON "checklist_items"("checklist_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_checklist_items_checklist_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_signatures_inspection_signed_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_evidences_inspection_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inspection_items_inspection_created_at"`,
    );
  }
}
