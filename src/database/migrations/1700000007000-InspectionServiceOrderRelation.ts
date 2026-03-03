import { MigrationInterface, QueryRunner } from 'typeorm';

export class InspectionServiceOrderRelation1700000007000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD COLUMN "service_order_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD CONSTRAINT "FK_inspections_service_order"
      FOREIGN KEY ("service_order_id") REFERENCES "service_orders"("id")
      ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_inspections_service_order" ON "inspections"("service_order_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_inspections_service_order"
    `);

    await queryRunner.query(`
      ALTER TABLE "inspections"
      DROP CONSTRAINT IF EXISTS "FK_inspections_service_order"
    `);

    await queryRunner.query(`
      ALTER TABLE "inspections"
      DROP COLUMN IF EXISTS "service_order_id"
    `);
  }
}
