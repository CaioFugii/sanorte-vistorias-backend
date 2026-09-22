import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChecklistServiceDescriptionSuggestions1700000045000
  implements MigrationInterface
{
  name = 'ChecklistServiceDescriptionSuggestions1700000045000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "checklists"
      ADD COLUMN "service_description_suggestions" text[] NOT NULL DEFAULT '{}'
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_description_options"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "checklists"
      DROP COLUMN "service_description_suggestions"
    `);
    await queryRunner.query(`
      CREATE TABLE "service_description_options" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_service_description_options" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_service_description_options_name" UNIQUE ("name")
      )
    `);
  }
}
