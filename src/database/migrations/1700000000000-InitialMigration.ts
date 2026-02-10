import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criar enum types
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM('ADMIN', 'GESTOR', 'FISCAL');
      CREATE TYPE "module_type_enum" AS ENUM('SEGURANCA_TRABALHO', 'OBRAS_INVESTIMENTO', 'OBRAS_GLOBAL', 'CANTEIRO');
      CREATE TYPE "inspection_status_enum" AS ENUM('RASCUNHO', 'FINALIZADA', 'PENDENTE_AJUSTE', 'RESOLVIDA');
      CREATE TYPE "checklist_answer_enum" AS ENUM('CONFORME', 'NAO_CONFORME', 'NAO_APLICAVEL');
      CREATE TYPE "pending_status_enum" AS ENUM('PENDENTE', 'RESOLVIDA');
    `);

    // Users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "role" "user_role_enum" NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Teams
    await queryRunner.query(`
      CREATE TABLE "teams" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teams" PRIMARY KEY ("id")
      )
    `);

    // Collaborators
    await queryRunner.query(`
      CREATE TABLE "collaborators" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_collaborators" PRIMARY KEY ("id")
      )
    `);

    // Team Collaborators (join table)
    await queryRunner.query(`
      CREATE TABLE "team_collaborators" (
        "team_id" uuid NOT NULL,
        "collaborator_id" uuid NOT NULL,
        CONSTRAINT "PK_team_collaborators" PRIMARY KEY ("team_id", "collaborator_id")
      )
    `);

    // Checklists
    await queryRunner.query(`
      CREATE TABLE "checklists" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "module" "module_type_enum" NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_checklists" PRIMARY KEY ("id")
      )
    `);

    // Checklist Items
    await queryRunner.query(`
      CREATE TABLE "checklist_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "checklist_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "description" text,
        "order" integer NOT NULL,
        "requires_photo_on_non_conformity" boolean NOT NULL DEFAULT true,
        "active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_checklist_items" PRIMARY KEY ("id")
      )
    `);

    // Inspections
    await queryRunner.query(`
      CREATE TABLE "inspections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "module" "module_type_enum" NOT NULL,
        "checklist_id" uuid NOT NULL,
        "team_id" uuid NOT NULL,
        "service_description" text NOT NULL,
        "location_description" text,
        "status" "inspection_status_enum" NOT NULL DEFAULT 'RASCUNHO',
        "score_percent" numeric(5,2),
        "created_by_user_id" uuid NOT NULL,
        "finalized_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inspections" PRIMARY KEY ("id")
      )
    `);

    // Inspection Collaborators (join table)
    await queryRunner.query(`
      CREATE TABLE "inspection_collaborators" (
        "inspection_id" uuid NOT NULL,
        "collaborator_id" uuid NOT NULL,
        CONSTRAINT "PK_inspection_collaborators" PRIMARY KEY ("inspection_id", "collaborator_id")
      )
    `);

    // Inspection Items
    await queryRunner.query(`
      CREATE TABLE "inspection_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "inspection_id" uuid NOT NULL,
        "checklist_item_id" uuid NOT NULL,
        "answer" "checklist_answer_enum",
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inspection_items" PRIMARY KEY ("id")
      )
    `);

    // Evidences
    await queryRunner.query(`
      CREATE TABLE "evidences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "inspection_id" uuid NOT NULL,
        "inspection_item_id" uuid,
        "file_path" character varying NOT NULL,
        "file_name" character varying NOT NULL,
        "mime_type" character varying NOT NULL,
        "size" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "uploaded_by_user_id" uuid NOT NULL,
        CONSTRAINT "PK_evidences" PRIMARY KEY ("id")
      )
    `);

    // Signatures
    await queryRunner.query(`
      CREATE TABLE "signatures" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "inspection_id" uuid NOT NULL,
        "signer_name" character varying NOT NULL,
        "signer_role_label" character varying NOT NULL DEFAULT 'Lider/Encarregado',
        "image_path" character varying NOT NULL,
        "signed_at" TIMESTAMP NOT NULL,
        CONSTRAINT "PK_signatures" PRIMARY KEY ("id")
      )
    `);

    // Pending Adjustments
    await queryRunner.query(`
      CREATE TABLE "pending_adjustments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "inspection_id" uuid NOT NULL,
        "status" "pending_status_enum" NOT NULL DEFAULT 'PENDENTE',
        "resolved_at" TIMESTAMP,
        "resolved_by_user_id" uuid,
        "resolution_notes" text,
        "resolution_evidence_path" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_pending_adjustments_inspection_id" UNIQUE ("inspection_id"),
        CONSTRAINT "PK_pending_adjustments" PRIMARY KEY ("id")
      )
    `);

    // Foreign Keys
    await queryRunner.query(`
      ALTER TABLE "team_collaborators" ADD CONSTRAINT "FK_team_collaborators_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE;
      ALTER TABLE "team_collaborators" ADD CONSTRAINT "FK_team_collaborators_collaborator" FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE CASCADE;
      ALTER TABLE "checklist_items" ADD CONSTRAINT "FK_checklist_items_checklist" FOREIGN KEY ("checklist_id") REFERENCES "checklists"("id") ON DELETE CASCADE;
      ALTER TABLE "inspections" ADD CONSTRAINT "FK_inspections_checklist" FOREIGN KEY ("checklist_id") REFERENCES "checklists"("id");
      ALTER TABLE "inspections" ADD CONSTRAINT "FK_inspections_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id");
      ALTER TABLE "inspections" ADD CONSTRAINT "FK_inspections_user" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");
      ALTER TABLE "inspection_collaborators" ADD CONSTRAINT "FK_inspection_collaborators_inspection" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE;
      ALTER TABLE "inspection_collaborators" ADD CONSTRAINT "FK_inspection_collaborators_collaborator" FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE CASCADE;
      ALTER TABLE "inspection_items" ADD CONSTRAINT "FK_inspection_items_inspection" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE;
      ALTER TABLE "inspection_items" ADD CONSTRAINT "FK_inspection_items_checklist_item" FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items"("id");
      ALTER TABLE "evidences" ADD CONSTRAINT "FK_evidences_inspection" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE;
      ALTER TABLE "evidences" ADD CONSTRAINT "FK_evidences_inspection_item" FOREIGN KEY ("inspection_item_id") REFERENCES "inspection_items"("id") ON DELETE SET NULL;
      ALTER TABLE "evidences" ADD CONSTRAINT "FK_evidences_user" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id");
      ALTER TABLE "signatures" ADD CONSTRAINT "FK_signatures_inspection" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE;
      ALTER TABLE "pending_adjustments" ADD CONSTRAINT "FK_pending_adjustments_inspection" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE;
      ALTER TABLE "pending_adjustments" ADD CONSTRAINT "FK_pending_adjustments_user" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
    `);

    // Indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_inspections_module" ON "inspections"("module");
      CREATE INDEX "IDX_inspections_status" ON "inspections"("status");
      CREATE INDEX "IDX_inspections_created_at" ON "inspections"("created_at");
      CREATE INDEX "IDX_inspections_team" ON "inspections"("team_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "pending_adjustments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "signatures" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "evidences" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inspection_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inspection_collaborators" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inspections" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "checklist_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "checklists" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_collaborators" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "collaborators" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teams" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "pending_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "checklist_answer_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "inspection_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "module_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
  }
}
