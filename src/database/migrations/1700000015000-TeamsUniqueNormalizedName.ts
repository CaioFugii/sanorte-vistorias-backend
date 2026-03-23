import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeamsUniqueNormalizedName1700000015000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_teams_name_normalized"
      ON "teams" (LOWER(BTRIM("name")))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_teams_name_normalized"
    `);
  }
}
