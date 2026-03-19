import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServiceOrderImportColumns1700000013000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "service_orders"
      ADD COLUMN IF NOT EXISTS "resultado" text NULL,
      ADD COLUMN IF NOT EXISTS "fim_execucao" text NULL,
      ADD COLUMN IF NOT EXISTS "tempo_execucao_efetivo" text NULL,
      ADD COLUMN IF NOT EXISTS "equipe" text NULL,
      ADD COLUMN IF NOT EXISTS "status" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "service_orders"
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "equipe",
      DROP COLUMN IF EXISTS "tempo_execucao_efetivo",
      DROP COLUMN IF EXISTS "fim_execucao",
      DROP COLUMN IF EXISTS "resultado"
    `);
  }
}
