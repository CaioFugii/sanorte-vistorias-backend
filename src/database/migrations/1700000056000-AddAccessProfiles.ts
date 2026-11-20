import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccessProfiles1700000056000 implements MigrationInterface {
  name = 'AddAccessProfiles1700000056000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "access_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" text,
        "is_system" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_access_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_access_profiles_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "access_profile_areas" (
        "access_profile_id" uuid NOT NULL,
        "area" character varying NOT NULL,
        CONSTRAINT "PK_access_profile_areas" PRIMARY KEY ("access_profile_id", "area"),
        CONSTRAINT "FK_access_profile_areas_profile"
          FOREIGN KEY ("access_profile_id") REFERENCES "access_profiles"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "access_profile_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_access_profile"
      FOREIGN KEY ("access_profile_id") REFERENCES "access_profiles"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_access_profile_id"
      ON "users" ("access_profile_id")
    `);

    await queryRunner.query(`
      INSERT INTO "access_profiles" ("name", "is_system")
      VALUES ('Gestor', true), ('Supervisor', true), ('Fiscal', true)
    `);

    await queryRunner.query(`
      INSERT INTO "access_profile_areas" ("access_profile_id", "area")
      SELECT "id", "area"
      FROM "access_profiles"
      CROSS JOIN (
        VALUES
          ('gestao'),
          ('qualidade_dados'),
          ('qualidade_painel'),
          ('qualidade_pendencias'),
          ('seguranca_dados'),
          ('engenharia_obras'),
          ('engenharia_relatorios')
      ) AS areas("area")
      WHERE "name" = 'Gestor'
    `);

    await queryRunner.query(`
      INSERT INTO "access_profile_areas" ("access_profile_id", "area")
      SELECT "id", "area"
      FROM "access_profiles"
      CROSS JOIN (
        VALUES
          ('gestao'),
          ('qualidade_dados'),
          ('qualidade_pendencias'),
          ('seguranca_dados'),
          ('engenharia_relatorios')
      ) AS areas("area")
      WHERE "name" = 'Supervisor'
    `);

    await queryRunner.query(`
      INSERT INTO "access_profile_areas" ("access_profile_id", "area")
      SELECT "id", "area"
      FROM "access_profiles"
      CROSS JOIN (
        VALUES
          ('campo_minhas'),
          ('campo_nova'),
          ('engenharia_relatorios')
      ) AS areas("area")
      WHERE "name" = 'Fiscal'
    `);

    await queryRunner.query(`
      UPDATE "users" AS "user"
      SET "access_profile_id" = "profile"."id"
      FROM "access_profiles" AS "profile"
      WHERE ("user"."role"::text = 'GESTOR' AND "profile"."name" = 'Gestor')
         OR ("user"."role"::text = 'SUPERVISOR' AND "profile"."name" = 'Supervisor')
         OR ("user"."role"::text = 'FISCAL' AND "profile"."name" = 'Fiscal')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_access_profile"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_users_access_profile_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "access_profile_id"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "access_profile_areas"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "access_profiles"`);
  }
}
