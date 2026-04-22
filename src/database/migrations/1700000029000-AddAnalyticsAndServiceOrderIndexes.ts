import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAnalyticsAndServiceOrderIndexes1700000029000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inspection_items_non_conform_checklist_item"
      ON "inspection_items"("checklist_item_id")
      WHERE "answer" = 'NAO_CONFORME'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_orders_contract_os_number"
      ON "service_orders"("contract_id", "os_number")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_service_orders_contract_os_number"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inspection_items_non_conform_checklist_item"`,
    );
  }
}
