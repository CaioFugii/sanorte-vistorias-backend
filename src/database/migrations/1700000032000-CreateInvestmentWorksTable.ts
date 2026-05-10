import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvestmentWorksTable1700000032000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'investment_work_status_enum') THEN
          CREATE TYPE "investment_work_status_enum" AS ENUM (
            'EM_ANDAMENTO',
            'PARALISADA',
            'FINALIZADA',
            'CANCELADA'
          );
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "investment_works" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "contract_id" uuid NOT NULL,
        "created_by_user_id" uuid NOT NULL,
        "work_name" character varying NOT NULL,
        "start_date" date NOT NULL,
        "expected_end_date" date NOT NULL,
        "address" text NOT NULL,
        "district" text NOT NULL,
        "basin" text NOT NULL,
        "service" text NOT NULL,
        "team_id" uuid NOT NULL,
        "material_network" text NOT NULL,
        "singularities" text,
        "status" "investment_work_status_enum" NOT NULL DEFAULT 'EM_ANDAMENTO',
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_investment_works" PRIMARY KEY ("id"),
        CONSTRAINT "FK_investment_works_contract" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_investment_works_created_by_user" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_investment_works_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_investment_works_contract_id"
      ON "investment_works"("contract_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_investment_works_status"
      ON "investment_works"("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_investment_works_created_at"
      ON "investment_works"("created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_investment_works_team_id"
      ON "investment_works"("team_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_investment_works_team_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_investment_works_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_investment_works_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_investment_works_contract_id"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "investment_works"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "investment_work_status_enum"`,
    );
  }
}
