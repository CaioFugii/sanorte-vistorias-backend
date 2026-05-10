import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvestmentWorkToInspections1700000033000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD COLUMN IF NOT EXISTS "investment_work_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD CONSTRAINT "FK_inspections_investment_work"
      FOREIGN KEY ("investment_work_id") REFERENCES "investment_works"("id")
      ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inspections_investment_work_id"
      ON "inspections"("investment_work_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inspections_module"
      ON "inspections"("module")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inspections_investment_work_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inspections_module"`);

    await queryRunner.query(`
      ALTER TABLE "inspections"
      DROP CONSTRAINT IF EXISTS "FK_inspections_investment_work"
    `);

    await queryRunner.query(`
      ALTER TABLE "inspections"
      DROP COLUMN IF EXISTS "investment_work_id"
    `);
  }
}
