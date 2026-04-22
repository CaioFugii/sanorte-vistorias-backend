import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHighPriorityQueryIndexes1700000028000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inspections_created_by_created_at"
      ON "inspections"("created_by_user_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inspection_collaborators_collaborator_inspection"
      ON "inspection_collaborators"("collaborator_id", "inspection_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_orders_contract_fim_execucao"
      ON "service_orders"("contract_id", "fim_execucao")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inspection_items_checklist_item_id"
      ON "inspection_items"("checklist_item_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_evidences_inspection_item_id_not_null"
      ON "evidences"("inspection_item_id")
      WHERE "inspection_item_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_evidences_inspection_item_id_not_null"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inspection_items_checklist_item_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_service_orders_contract_fim_execucao"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inspection_collaborators_collaborator_inspection"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inspections_created_by_created_at"`,
    );
  }
}
