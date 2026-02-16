import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChecklistSectionsAndOfflineSyncColumns1700000001000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "module_type_enum" ADD VALUE IF NOT EXISTS 'QUALIDADE'
    `);

    await queryRunner.query(`
      CREATE TABLE "checklist_sections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "checklist_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "order" integer NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_checklist_sections" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "checklist_sections"
      ADD CONSTRAINT "FK_checklist_sections_checklist"
      FOREIGN KEY ("checklist_id") REFERENCES "checklists"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_checklist_sections_checklist_order"
      ON "checklist_sections"("checklist_id", "order")
    `);

    await queryRunner.query(`
      ALTER TABLE "checklist_items"
      ADD COLUMN "section_id" uuid
    `);

    await queryRunner.query(`
      INSERT INTO "checklist_sections" (
        "id",
        "checklist_id",
        "name",
        "order",
        "active",
        "created_at",
        "updated_at"
      )
      SELECT
        uuid_generate_v4(),
        c.id,
        'Seção padrão',
        1,
        true,
        now(),
        now()
      FROM "checklists" c
      WHERE NOT EXISTS (
        SELECT 1
        FROM "checklist_sections" cs
        WHERE cs."checklist_id" = c.id
      )
    `);

    await queryRunner.query(`
      UPDATE "checklist_items" ci
      SET "section_id" = cs.id
      FROM "checklist_sections" cs
      WHERE cs."checklist_id" = ci."checklist_id"
      AND cs."order" = 1
    `);

    await queryRunner.query(`
      ALTER TABLE "checklist_items"
      ALTER COLUMN "section_id" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "checklist_items"
      ADD CONSTRAINT "FK_checklist_items_section"
      FOREIGN KEY ("section_id") REFERENCES "checklist_sections"("id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_checklist_items_section" ON "checklist_items"("section_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "inspections"
      ADD COLUMN "external_id" uuid,
      ADD COLUMN "created_offline" boolean NOT NULL DEFAULT false,
      ADD COLUMN "synced_at" TIMESTAMP
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_inspections_external_id"
      ON "inspections"("external_id")
      WHERE "external_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inspections_external_id"`);

    await queryRunner.query(`
      ALTER TABLE "inspections"
      DROP COLUMN IF EXISTS "synced_at",
      DROP COLUMN IF EXISTS "created_offline",
      DROP COLUMN IF EXISTS "external_id"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_checklist_items_section"`);

    await queryRunner.query(`
      ALTER TABLE "checklist_items"
      DROP CONSTRAINT IF EXISTS "FK_checklist_items_section"
    `);

    await queryRunner.query(`
      ALTER TABLE "checklist_items"
      DROP COLUMN IF EXISTS "section_id"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_checklist_sections_checklist_order"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "checklist_sections" CASCADE`);
  }
}
