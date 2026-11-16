import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateServiceOrderImports1700000052000 implements MigrationInterface {
  name = 'CreateServiceOrderImports1700000052000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "service_order_imports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "contract_id" uuid NOT NULL,
        "original_file_name" character varying NOT NULL,
        "storage_key" character varying NOT NULL,
        "storage_provider" character varying NOT NULL,
        "inserted_count" integer NOT NULL,
        "skipped_count" integer NOT NULL,
        "deleted_count" integer NOT NULL,
        "not_registered_count" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_service_order_imports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_service_order_imports_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_service_order_imports_contract"
          FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_service_order_imports_contract_created"
      ON "service_order_imports" ("contract_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "service_order_import_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "import_id" uuid NOT NULL,
        "line_number" integer NOT NULL,
        "status" character varying NOT NULL,
        "os_number" character varying,
        "sector_name" character varying,
        "resultado" character varying,
        "reason" text,
        "raw_row" jsonb NOT NULL,
        "resolved_at" TIMESTAMP,
        CONSTRAINT "PK_service_order_import_lines" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_service_order_import_lines_status"
          CHECK ("status" IN ('entered', 'not_registered')),
        CONSTRAINT "FK_service_order_import_lines_import"
          FOREIGN KEY ("import_id") REFERENCES "service_order_imports"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_service_order_import_lines_import"
      ON "service_order_import_lines" ("import_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "service_order_import_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_order_imports"`);
  }
}
