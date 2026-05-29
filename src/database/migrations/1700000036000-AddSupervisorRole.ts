import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupervisorRole1700000036000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "user_role_enum" ADD VALUE IF NOT EXISTS 'SUPERVISOR'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "users" WHERE "role" = 'SUPERVISOR'
    `);

    await queryRunner.query(`
      ALTER TYPE "user_role_enum" RENAME TO "user_role_enum_old"
    `);
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM('ADMIN', 'GESTOR', 'FISCAL')
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "role"
      TYPE "user_role_enum"
      USING ("role"::text::"user_role_enum")
    `);
    await queryRunner.query(`
      DROP TYPE "user_role_enum_old"
    `);
  }
}
