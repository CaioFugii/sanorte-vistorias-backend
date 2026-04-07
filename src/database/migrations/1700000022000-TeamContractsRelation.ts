import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeamContractsRelation1700000022000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "team_contracts" (
        "team_id" uuid NOT NULL,
        "contract_id" uuid NOT NULL,
        CONSTRAINT "PK_team_contracts" PRIMARY KEY ("team_id", "contract_id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "team_contracts"
      ADD CONSTRAINT "FK_team_contracts_team"
      FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "team_contracts"
      ADD CONSTRAINT "FK_team_contracts_contract"
      FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_team_contracts_contract_id"
      ON "team_contracts"("contract_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_team_contracts_contract_id"`);
    await queryRunner.query(`
      ALTER TABLE "team_contracts"
      DROP CONSTRAINT IF EXISTS "FK_team_contracts_contract"
    `);
    await queryRunner.query(`
      ALTER TABLE "team_contracts"
      DROP CONSTRAINT IF EXISTS "FK_team_contracts_team"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_contracts"`);
  }
}
