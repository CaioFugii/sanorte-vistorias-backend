import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParalysisPenaltyPercent1700000047000
  implements MigrationInterface
{
  name = 'AddParalysisPenaltyPercent1700000047000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD COLUMN "paralysis_penalty_percent" integer
    `);

    await queryRunner.query(`
      UPDATE "inspections"
      SET "paralysis_penalty_percent" = 25
      WHERE "has_paralysis_penalty" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inspections"
      DROP COLUMN IF EXISTS "paralysis_penalty_percent"
    `);
  }
}
