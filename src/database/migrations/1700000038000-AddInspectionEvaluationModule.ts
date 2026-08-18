import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInspectionEvaluationModule1700000038000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'investment_work_evaluation_module_enum'
        ) THEN
          CREATE TYPE "investment_work_evaluation_module_enum" AS ENUM ('CAMPO', 'POS_OBRA');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD COLUMN IF NOT EXISTS "evaluation_module" "investment_work_evaluation_module_enum"
    `);

    await queryRunner.query(`
      UPDATE "inspections"
      SET "evaluation_module" = 'CAMPO'
      WHERE "module" = 'OBRAS_INVESTIMENTO'
        AND "evaluation_module" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inspections"
      DROP COLUMN IF EXISTS "evaluation_module"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "investment_work_evaluation_module_enum"
    `);
  }
}
