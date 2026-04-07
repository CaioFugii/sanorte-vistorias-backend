import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveCitiesFromContracts1700000023000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contract_cities_city_id"`);
    await queryRunner.query(`
      ALTER TABLE "contract_cities"
      DROP CONSTRAINT IF EXISTS "FK_contract_cities_city"
    `);
    await queryRunner.query(`
      ALTER TABLE "contract_cities"
      DROP CONSTRAINT IF EXISTS "FK_contract_cities_contract"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "contract_cities"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cities"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cities" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_cities_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contract_cities" (
        "contract_id" uuid NOT NULL,
        "city_id" uuid NOT NULL,
        CONSTRAINT "PK_contract_cities" PRIMARY KEY ("contract_id", "city_id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "contract_cities"
      ADD CONSTRAINT "FK_contract_cities_contract"
      FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "contract_cities"
      ADD CONSTRAINT "FK_contract_cities_city"
      FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contract_cities_city_id"
      ON "contract_cities"("city_id")
    `);
  }
}
