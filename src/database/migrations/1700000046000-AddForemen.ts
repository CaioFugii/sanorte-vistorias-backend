import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddForemen1700000046000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "foremen" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_foremen" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_foremen_name_normalized"
      ON "foremen" (LOWER(BTRIM("name")))
    `);

    await queryRunner.query(`
      ALTER TABLE "teams"
      ADD COLUMN IF NOT EXISTS "foreman_id" uuid
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_teams_foreman'
        ) THEN
          ALTER TABLE "teams"
          ADD CONSTRAINT "FK_teams_foreman"
          FOREIGN KEY ("foreman_id") REFERENCES "foremen"("id")
          ON DELETE RESTRICT;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_teams_foreman_id"
      ON "teams" ("foreman_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_teams_foreman_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "FK_teams_foreman"
    `);
    await queryRunner.query(`
      ALTER TABLE "teams" DROP COLUMN IF EXISTS "foreman_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_foremen_name_normalized"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "foremen"
    `);
  }
}
