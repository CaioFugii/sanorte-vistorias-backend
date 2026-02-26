import { MigrationInterface, QueryRunner } from 'typeorm';

export class SectorsAndRelations1700000004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sectors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sectors" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_sectors_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "sectors" ("name", "active", "created_at", "updated_at")
      VALUES
        ('ESGOTO', true, now(), now()),
        ('AGUA', true, now(), now()),
        ('REPOSICAO', true, now(), now())
      ON CONFLICT ("name") DO NOTHING
    `);

    await queryRunner.query(`
      ALTER TABLE "collaborators"
      ADD COLUMN "sector_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "checklists"
      ADD COLUMN "sector_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_collaborators_sector_id"
      ON "collaborators"("sector_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_checklists_sector_id"
      ON "checklists"("sector_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "collaborators"
      ADD CONSTRAINT "FK_collaborators_sector"
      FOREIGN KEY ("sector_id") REFERENCES "sectors"("id")
      ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "checklists"
      ADD CONSTRAINT "FK_checklists_sector"
      FOREIGN KEY ("sector_id") REFERENCES "sectors"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "checklists"
      DROP CONSTRAINT IF EXISTS "FK_checklists_sector"
    `);

    await queryRunner.query(`
      ALTER TABLE "collaborators"
      DROP CONSTRAINT IF EXISTS "FK_collaborators_sector"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_checklists_sector_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_collaborators_sector_id"`);

    await queryRunner.query(`
      ALTER TABLE "checklists"
      DROP COLUMN IF EXISTS "sector_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "collaborators"
      DROP COLUMN IF EXISTS "sector_id"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "sectors" CASCADE`);
  }
}
