import { MigrationInterface, QueryRunner } from 'typeorm';

export class RecountServiceOrderImportTotals1700000055000
  implements MigrationInterface
{
  name = 'RecountServiceOrderImportTotals1700000055000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "service_order_imports" i
      SET
        "inserted_count" = (
          SELECT COUNT(*)
          FROM "service_order_import_lines" l
          WHERE l."import_id" = i."id"
            AND l."status" = 'entered'
        ),
        "not_registered_count" = (
          SELECT COUNT(*)
          FROM "service_order_import_lines" l
          WHERE l."import_id" = i."id"
            AND l."status" = 'not_registered'
        )
    `);
  }

  public async down(): Promise<void> {
    // Os totais antigos do upload não ficam guardados em outro lugar.
  }
}
