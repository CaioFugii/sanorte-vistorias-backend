import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInspectionScopeColumn1700000017000
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
      ALTER TABLE "inspections"
      ADD COLUMN IF NOT EXISTS "inspection_scope" "inspection_scope_enum" NOT NULL DEFAULT 'TEAM'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inspections"
      DROP COLUMN IF EXISTS "inspection_scope"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "inspection_scope_enum"
    `);
  }
}
