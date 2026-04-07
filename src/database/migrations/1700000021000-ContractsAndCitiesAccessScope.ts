import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContractsAndCitiesAccessScope1700000021000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "contracts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contracts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_contracts_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_contracts" (
        "user_id" uuid NOT NULL,
        "contract_id" uuid NOT NULL,
        CONSTRAINT "PK_user_contracts" PRIMARY KEY ("user_id", "contract_id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "service_orders"
      ADD COLUMN "contract_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "user_contracts"
      ADD CONSTRAINT "FK_user_contracts_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "user_contracts"
      ADD CONSTRAINT "FK_user_contracts_contract"
      FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "service_orders"
      ADD CONSTRAINT "FK_service_orders_contract"
      FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_service_orders_contract_id"
      ON "service_orders"("contract_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_contracts_contract_id"
      ON "user_contracts"("contract_id")
    `);

    await queryRunner.query(`
      WITH initial_contract AS (
        INSERT INTO "contracts" ("name")
        VALUES ('CONTRATO_INICIAL')
        RETURNING "id"
      )
      SELECT "id" FROM initial_contract
    `);

    await queryRunner.query(`
      INSERT INTO "user_contracts" ("user_id", "contract_id")
      SELECT u."id", c."id"
      FROM "users" u
      CROSS JOIN "contracts" c
      WHERE c."name" = 'CONTRATO_INICIAL'
        AND u."role" IN ('GESTOR', 'FISCAL')
    `);

    await queryRunner.query(`
      UPDATE "service_orders"
      SET "contract_id" = c."id"
      FROM "contracts" c
      WHERE c."name" = 'CONTRATO_INICIAL'
        AND "service_orders"."contract_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_contracts_contract_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_service_orders_contract_id"`);
    await queryRunner.query(`
      ALTER TABLE "service_orders"
      DROP CONSTRAINT IF EXISTS "FK_service_orders_contract"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_contracts"
      DROP CONSTRAINT IF EXISTS "FK_user_contracts_contract"
    `);
    await queryRunner.query(`
      ALTER TABLE "user_contracts"
      DROP CONSTRAINT IF EXISTS "FK_user_contracts_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "service_orders"
      DROP COLUMN IF EXISTS "contract_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_contracts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contracts"`);
  }
}
