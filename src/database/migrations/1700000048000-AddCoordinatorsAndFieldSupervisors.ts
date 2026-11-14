import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoordinatorsAndFieldSupervisors1700000048000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coordinators" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coordinators" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coordinator_contracts" (
        "coordinator_id" uuid NOT NULL,
        "contract_id" uuid NOT NULL,
        CONSTRAINT "PK_coordinator_contracts" PRIMARY KEY ("coordinator_id", "contract_id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_coordinator_contracts_coordinator'
        ) THEN
          ALTER TABLE "coordinator_contracts"
          ADD CONSTRAINT "FK_coordinator_contracts_coordinator"
          FOREIGN KEY ("coordinator_id") REFERENCES "coordinators"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_coordinator_contracts_contract'
        ) THEN
          ALTER TABLE "coordinator_contracts"
          ADD CONSTRAINT "FK_coordinator_contracts_contract"
          FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_coordinator_contracts_contract_id"
      ON "coordinator_contracts" ("contract_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "field_supervisors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "coordinator_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_field_supervisors" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_field_supervisors_coordinator'
        ) THEN
          ALTER TABLE "field_supervisors"
          ADD CONSTRAINT "FK_field_supervisors_coordinator"
          FOREIGN KEY ("coordinator_id") REFERENCES "coordinators"("id")
          ON DELETE RESTRICT;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_field_supervisors_coordinator_id"
      ON "field_supervisors" ("coordinator_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "field_supervisor_contracts" (
        "field_supervisor_id" uuid NOT NULL,
        "contract_id" uuid NOT NULL,
        CONSTRAINT "PK_field_supervisor_contracts" PRIMARY KEY ("field_supervisor_id", "contract_id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_field_supervisor_contracts_field_supervisor'
        ) THEN
          ALTER TABLE "field_supervisor_contracts"
          ADD CONSTRAINT "FK_field_supervisor_contracts_field_supervisor"
          FOREIGN KEY ("field_supervisor_id") REFERENCES "field_supervisors"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_field_supervisor_contracts_contract'
        ) THEN
          ALTER TABLE "field_supervisor_contracts"
          ADD CONSTRAINT "FK_field_supervisor_contracts_contract"
          FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_field_supervisor_contracts_contract_id"
      ON "field_supervisor_contracts" ("contract_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "foremen"
      ADD COLUMN IF NOT EXISTS "field_supervisor_id" uuid
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_foremen_field_supervisor'
        ) THEN
          ALTER TABLE "foremen"
          ADD CONSTRAINT "FK_foremen_field_supervisor"
          FOREIGN KEY ("field_supervisor_id") REFERENCES "field_supervisors"("id")
          ON DELETE RESTRICT;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_foremen_field_supervisor_id"
      ON "foremen" ("field_supervisor_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_foremen_field_supervisor_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "foremen" DROP CONSTRAINT IF EXISTS "FK_foremen_field_supervisor"
    `);
    await queryRunner.query(`
      ALTER TABLE "foremen" DROP COLUMN IF EXISTS "field_supervisor_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_field_supervisor_contracts_contract_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "field_supervisor_contracts"
      DROP CONSTRAINT IF EXISTS "FK_field_supervisor_contracts_contract"
    `);
    await queryRunner.query(`
      ALTER TABLE "field_supervisor_contracts"
      DROP CONSTRAINT IF EXISTS "FK_field_supervisor_contracts_field_supervisor"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "field_supervisor_contracts"`);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_field_supervisors_coordinator_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "field_supervisors" DROP CONSTRAINT IF EXISTS "FK_field_supervisors_coordinator"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "field_supervisors"`);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_coordinator_contracts_contract_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "coordinator_contracts"
      DROP CONSTRAINT IF EXISTS "FK_coordinator_contracts_contract"
    `);
    await queryRunner.query(`
      ALTER TABLE "coordinator_contracts"
      DROP CONSTRAINT IF EXISTS "FK_coordinator_contracts_coordinator"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "coordinator_contracts"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "coordinators"`);
  }
}
