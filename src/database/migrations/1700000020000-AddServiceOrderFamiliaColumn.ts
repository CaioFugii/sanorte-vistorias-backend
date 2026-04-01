import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServiceOrderFamiliaColumn1700000020000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "service_orders"
      ADD COLUMN IF NOT EXISTS "familia" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "service_orders"
      DROP COLUMN IF EXISTS "familia"
    `);
  }
}
