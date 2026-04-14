import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContractIdToCollaborators1700000026000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "collaborators"
      ADD COLUMN "contract_id" uuid NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "collaborators"
      ADD CONSTRAINT "FK_collaborators_contract"
      FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_collaborators_contract_id"
      ON "collaborators"("contract_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_collaborators_contract_id"`);

    await queryRunner.query(`
      ALTER TABLE "collaborators"
      DROP CONSTRAINT IF EXISTS "FK_collaborators_contract"
    `);

    await queryRunner.query(`
      ALTER TABLE "collaborators"
      DROP COLUMN IF EXISTS "contract_id"
    `);
  }
}
