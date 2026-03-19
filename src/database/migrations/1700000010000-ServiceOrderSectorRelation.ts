import { MigrationInterface, QueryRunner } from 'typeorm';

export class ServiceOrderSectorRelation1700000010000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "service_orders"
      ADD COLUMN "sector_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_service_orders_sector_id"
      ON "service_orders"("sector_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "service_orders"
      ADD CONSTRAINT "FK_service_orders_sector"
      FOREIGN KEY ("sector_id") REFERENCES "sectors"("id")
      ON DELETE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "service_orders"
      DROP CONSTRAINT IF EXISTS "FK_service_orders_sector"
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_service_orders_sector_id"`,
    );

    await queryRunner.query(`
      ALTER TABLE "service_orders"
      DROP COLUMN IF EXISTS "sector_id"
    `);
  }
}
