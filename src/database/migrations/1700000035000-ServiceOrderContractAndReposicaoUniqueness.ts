import { MigrationInterface, QueryRunner } from 'typeorm';

export class ServiceOrderContractAndReposicaoUniqueness1700000035000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "service_orders"
      ADD COLUMN IF NOT EXISTS "service_identifier" text NOT NULL DEFAULT ''
    `);

    await queryRunner.query(`
      UPDATE "service_orders" so
      SET "service_identifier" = upper(trim(coalesce(so."resultado", '')))
      FROM "sectors" s
      WHERE so."sector_id" = s."id"
        AND s."name" = 'REPOSICAO'
    `);

    await queryRunner.query(`
      ALTER TABLE "service_orders"
      DROP CONSTRAINT IF EXISTS "UQ_os_number_sector_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "service_orders"
      DROP CONSTRAINT IF EXISTS "UQ_service_orders_contract_os_sector_service"
    `);

    await queryRunner.query(`
      ALTER TABLE "service_orders"
      ADD CONSTRAINT "UQ_service_orders_contract_os_sector_service"
      UNIQUE ("contract_id", "os_number", "sector_id", "service_identifier")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "service_orders"
      DROP CONSTRAINT IF EXISTS "UQ_service_orders_contract_os_sector_service"
    `);

    await queryRunner.query(`
      ALTER TABLE "service_orders"
      ADD CONSTRAINT "UQ_os_number_sector_id" UNIQUE ("os_number", "sector_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "service_orders"
      DROP COLUMN IF EXISTS "service_identifier"
    `);
  }
}
