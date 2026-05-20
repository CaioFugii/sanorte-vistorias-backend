import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContractToInspections1700000035000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD COLUMN IF NOT EXISTS "contract_id" uuid
    `);

    await queryRunner.query(`
      UPDATE "inspections" "i"
      SET "contract_id" = "so"."contract_id"
      FROM "service_orders" "so"
      WHERE "i"."service_order_id" = "so"."id"
        AND "i"."contract_id" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "inspections" "i"
      SET "contract_id" = "iw"."contract_id"
      FROM "investment_works" "iw"
      WHERE "i"."investment_work_id" = "iw"."id"
        AND "i"."contract_id" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD CONSTRAINT "FK_inspections_contract"
      FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
      ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inspections_contract_id"
      ON "inspections"("contract_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inspections_contract_id"`,
    );

    await queryRunner.query(`
      ALTER TABLE "inspections"
      DROP CONSTRAINT IF EXISTS "FK_inspections_contract"
    `);

    await queryRunner.query(`
      ALTER TABLE "inspections"
      DROP COLUMN IF EXISTS "contract_id"
    `);
  }
}
