import { MigrationInterface, QueryRunner } from 'typeorm';

export class ServiceOrderUniqueOsNumberSectorId1700000011000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "service_orders"
      DROP CONSTRAINT IF EXISTS "UQ_service_orders_os_number"
    `);

    await queryRunner.query(`
      ALTER TABLE "service_orders"
      ADD CONSTRAINT "UQ_os_number_sector_id" UNIQUE ("os_number", "sector_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "service_orders"
      DROP CONSTRAINT IF EXISTS "UQ_os_number_sector_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "service_orders"
      ADD CONSTRAINT "UQ_service_orders_os_number" UNIQUE ("os_number")
    `);
  }
}
