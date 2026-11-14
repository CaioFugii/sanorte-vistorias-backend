import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSafetyPendingRule1700000051000 implements MigrationInterface {
  name = 'AddSafetyPendingRule1700000051000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD COLUMN "safety_pending_rule" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inspections"
      DROP COLUMN IF EXISTS "safety_pending_rule"
    `);
  }
}
