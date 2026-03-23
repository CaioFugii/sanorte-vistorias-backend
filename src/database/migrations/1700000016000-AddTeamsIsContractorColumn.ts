import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeamsIsContractorColumn1700000016000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teams"
      ADD COLUMN IF NOT EXISTS "is_contractor" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teams"
      DROP COLUMN IF EXISTS "is_contractor"
    `);
  }
}
