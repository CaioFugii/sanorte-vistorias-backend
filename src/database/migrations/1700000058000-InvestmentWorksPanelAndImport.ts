import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rollback em produção só antes do primeiro cadastro por Excel.
 * Depois disso, `down` falha de propósito: `team_id`, `basin`, `service` e
 * `material_network` voltam a NOT NULL, e o cadastro IMPORT deixa esses campos nulos (R-6).
 */
export class InvestmentWorksPanelAndImport1700000058000 implements MigrationInterface {
  name = 'InvestmentWorksPanelAndImport1700000058000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'investment_work_origin_enum') THEN
          CREATE TYPE "investment_work_origin_enum" AS ENUM ('MANUAL', 'IMPORT');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE "investment_works"
        ADD COLUMN IF NOT EXISTS "origin" "investment_work_origin_enum" NOT NULL DEFAULT 'MANUAL',
        ADD COLUMN IF NOT EXISTS "pda_team_name" text,
        ADD COLUMN IF NOT EXISTS "sector_id" uuid,
        ALTER COLUMN "team_id" DROP NOT NULL,
        ALTER COLUMN "basin" DROP NOT NULL,
        ALTER COLUMN "service" DROP NOT NULL,
        ALTER COLUMN "material_network" DROP NOT NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_investment_works_sector'
        ) THEN
          ALTER TABLE "investment_works"
            ADD CONSTRAINT "FK_investment_works_sector"
            FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE RESTRICT;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "investment_work_imports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "contract_id" uuid NOT NULL,
        "original_file_name" character varying NOT NULL,
        "storage_key" character varying NOT NULL,
        "storage_provider" character varying NOT NULL,
        "selected_descriptions" jsonb NOT NULL,
        "created_count" int NOT NULL,
        "ignored_count" int NOT NULL,
        "not_selected_count" int NOT NULL,
        "not_registered_count" int NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_investment_work_imports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_investment_work_imports_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_investment_work_imports_contract" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_investment_work_imports_contract_created"
      ON "investment_work_imports" ("contract_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      ALTER TABLE "investment_works"
        ADD COLUMN IF NOT EXISTS "import_id" uuid
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_investment_works_import'
        ) THEN
          ALTER TABLE "investment_works"
            ADD CONSTRAINT "FK_investment_works_import"
            FOREIGN KEY ("import_id") REFERENCES "investment_work_imports"("id") ON DELETE SET NULL;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "investment_work_import_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "import_id" uuid NOT NULL,
        "line_number" int NOT NULL,
        "status" character varying NOT NULL,
        "os_number" character varying,
        "description" character varying,
        "reason" text NOT NULL,
        "raw_row" jsonb NOT NULL,
        CONSTRAINT "PK_investment_work_import_lines" PRIMARY KEY ("id"),
        CONSTRAINT "FK_investment_work_import_lines_import" FOREIGN KEY ("import_id") REFERENCES "investment_work_imports"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "investment_work_descriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "investment_work_id" uuid,
        "import_id" uuid NOT NULL,
        "contract_id" uuid NOT NULL,
        "os_number" character varying NOT NULL,
        "execution_date" date NOT NULL,
        "description" text NOT NULL,
        "description_key" text NOT NULL,
        CONSTRAINT "PK_investment_work_descriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_investment_work_descriptions_work" FOREIGN KEY ("investment_work_id") REFERENCES "investment_works"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_investment_work_descriptions_import" FOREIGN KEY ("import_id") REFERENCES "investment_work_imports"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_investment_work_descriptions_contract" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT,
        CONSTRAINT "UQ_investment_work_descriptions_key" UNIQUE ("contract_id", "os_number", "execution_date", "description_key")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_investment_work_descriptions_work"
      ON "investment_work_descriptions" ("investment_work_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_investment_works_origin_end_date"
      ON "investment_works" ("origin", "expected_end_date")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_investment_works_contract_end_date"
      ON "investment_works" ("contract_id", "expected_end_date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_investment_works_contract_end_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_investment_works_origin_end_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_investment_work_descriptions_work"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "investment_work_descriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "investment_work_import_lines"`);
    await queryRunner.query(`
      ALTER TABLE "investment_works" DROP CONSTRAINT IF EXISTS "FK_investment_works_import"
    `);
    await queryRunner.query(`
      ALTER TABLE "investment_works" DROP COLUMN IF EXISTS "import_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "investment_work_imports"`);
    await queryRunner.query(`
      ALTER TABLE "investment_works" DROP CONSTRAINT IF EXISTS "FK_investment_works_sector"
    `);
    await queryRunner.query(`
      ALTER TABLE "investment_works"
        DROP COLUMN IF EXISTS "sector_id",
        DROP COLUMN IF EXISTS "pda_team_name",
        DROP COLUMN IF EXISTS "origin"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "investment_work_origin_enum"`);
    await queryRunner.query(`
      ALTER TABLE "investment_works"
        ALTER COLUMN "team_id" SET NOT NULL,
        ALTER COLUMN "basin" SET NOT NULL,
        ALTER COLUMN "service" SET NOT NULL,
        ALTER COLUMN "material_network" SET NOT NULL
    `);
  }
}
