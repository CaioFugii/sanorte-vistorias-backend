import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChecklistInspectionScopeColumn1700000018000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inspection_scope_enum') THEN
          CREATE TYPE "inspection_scope_enum" AS ENUM ('TEAM', 'COLLABORATOR');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE "checklists"
      ADD COLUMN IF NOT EXISTS "inspection_scope" "inspection_scope_enum" NOT NULL DEFAULT 'TEAM'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "checklists"
      DROP COLUMN IF EXISTS "inspection_scope"
    `);
  }
}
