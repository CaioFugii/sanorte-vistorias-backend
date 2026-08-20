import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeamSectorsRelation1700000039000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "team_sectors" (
        "team_id" uuid NOT NULL,
        "sector_id" uuid NOT NULL,
        CONSTRAINT "PK_team_sectors" PRIMARY KEY ("team_id", "sector_id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "team_sectors"
      ADD CONSTRAINT "FK_team_sectors_team"
      FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "team_sectors"
      ADD CONSTRAINT "FK_team_sectors_sector"
      FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_team_sectors_sector_id"
      ON "team_sectors"("sector_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_team_sectors_sector_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "team_sectors"
      DROP CONSTRAINT IF EXISTS "FK_team_sectors_sector"
    `);
    await queryRunner.query(`
      ALTER TABLE "team_sectors"
      DROP CONSTRAINT IF EXISTS "FK_team_sectors_team"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_sectors"`);
  }
}
