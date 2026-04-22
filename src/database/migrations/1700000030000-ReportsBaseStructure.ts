import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportsBaseStructure1700000030000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_field_type_enum') THEN
          CREATE TYPE "report_field_type_enum" AS ENUM (
            'text',
            'textarea',
            'number',
            'date',
            'datetime',
            'select',
            'radio',
            'checkbox',
            'image',
            'signature'
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE "report_types" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "version" integer NOT NULL DEFAULT 1,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_types" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_report_types_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "report_type_fields" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "report_type_id" uuid NOT NULL,
        "field_key" character varying NOT NULL,
        "label" character varying NOT NULL,
        "type" "report_field_type_enum" NOT NULL,
        "required" boolean NOT NULL DEFAULT false,
        "order" integer NOT NULL,
        "placeholder" text,
        "help_text" text,
        "options" jsonb,
        "default_value" text,
        "multiple" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_type_fields" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_report_type_fields_type_field_key" UNIQUE ("report_type_id", "field_key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "report_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "report_type_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "schema_version" integer NOT NULL DEFAULT 1,
        "form_data" jsonb NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_records" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "report_files" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "report_record_id" uuid,
        "report_type_id" uuid,
        "field_key" character varying NOT NULL,
        "original_name" character varying NOT NULL,
        "mime_type" character varying NOT NULL,
        "size" integer NOT NULL,
        "url" character varying NOT NULL,
        "storage_provider" character varying NOT NULL,
        "storage_key" character varying NOT NULL,
        "public_id" character varying,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_files" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "report_type_fields"
      ADD CONSTRAINT "FK_report_type_fields_report_type"
      FOREIGN KEY ("report_type_id") REFERENCES "report_types"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "report_records"
      ADD CONSTRAINT "FK_report_records_report_type"
      FOREIGN KEY ("report_type_id") REFERENCES "report_types"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "report_records"
      ADD CONSTRAINT "FK_report_records_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "report_files"
      ADD CONSTRAINT "FK_report_files_report_record"
      FOREIGN KEY ("report_record_id") REFERENCES "report_records"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "report_files"
      ADD CONSTRAINT "FK_report_files_report_type"
      FOREIGN KEY ("report_type_id") REFERENCES "report_types"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "report_files"
      ADD CONSTRAINT "FK_report_files_created_by"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_report_types_active" ON "report_types" ("active");
      CREATE INDEX "IDX_report_type_fields_report_type_id_order" ON "report_type_fields" ("report_type_id", "order");
      CREATE INDEX "IDX_report_records_report_type_id" ON "report_records" ("report_type_id");
      CREATE INDEX "IDX_report_records_user_id" ON "report_records" ("user_id");
      CREATE INDEX "IDX_report_files_report_record_id" ON "report_files" ("report_record_id");
      CREATE INDEX "IDX_report_files_created_by" ON "report_files" ("created_by");
      CREATE INDEX "IDX_report_files_report_type_id_field_key" ON "report_files" ("report_type_id", "field_key");
    `);

    await queryRunner.query(`
      INSERT INTO "report_types" ("code", "name", "description", "version", "active")
      VALUES
        ('ACEITE_PAVIMENTO', 'Aceite de Pavimento', 'Seed inicial de formulario dinamico.', 1, true),
        ('RECOMPOSICAO', 'Recomposicao', 'Seed inicial de formulario dinamico.', 1, true),
        ('REGULARIZACAO', 'Regularizacao', 'Seed inicial de formulario dinamico.', 1, true),
        ('MANUTENCAO_CANTEIRO', 'Manutencao de canteiro', 'Seed inicial de formulario dinamico.', 1, true),
        ('PV_TRANSICAO', 'PV de transicao', 'Seed inicial de formulario dinamico.', 1, true),
        ('OBRAS_CIVIS_EEE', 'Obras civis EEE', 'Seed inicial de formulario dinamico.', 1, true),
        ('FORNECIMENTO_EEE_LR', 'Fornecimento EEE e LR', 'Seed inicial de formulario dinamico.', 1, true),
        ('MONTAGEM_EEE', 'Montagem EEE', 'Seed inicial de formulario dinamico.', 1, true),
        ('LIMPEZA_REDE', 'Limpeza de rede', 'Seed inicial de formulario dinamico.', 1, true),
        ('REPARO_NCF', 'Reparo de NCF', 'Seed inicial de formulario dinamico.', 1, true),
        ('LIGACOES', 'Ligacoes', 'Seed inicial de formulario dinamico.', 1, true),
        ('LIGACAO_PASSEIO', 'Ligacao e passeio', 'Seed inicial de formulario dinamico.', 1, true)
    `);

    await queryRunner.query(`
      WITH field_dictionary (field_id, field_key, label, field_type) AS (
        VALUES
          (1, 'titulo', 'Titulo', 'text'),
          (2, 'numero_medicao', 'N° da medicao', 'text'),
          (3, 'bacia', 'Bacia', 'text'),
          (4, 'rua_avenida', 'Rua/Avenida', 'text'),
          (5, 'montante', 'Montante', 'text'),
          (6, 'jusante', 'Jusante', 'text'),
          (7, 'bairro', 'Bairro', 'text'),
          (8, 'extensao', 'Extensao', 'number'),
          (9, 'diametro_rede', 'Diametro da rede', 'number'),
          (10, 'diametro_ramal', 'Diametro do ramal', 'number'),
          (11, 'data_atendimento', 'Data de atendimento', 'date'),
          (12, 'preco', 'Preco', 'number'),
          (13, 'material', 'Material', 'text'),
          (14, 'posicao', 'Posicao', 'text'),
          (15, 'profundidade_rede', 'Profundidade da rede', 'number'),
          (16, 'etapa', 'Etapa', 'text'),
          (17, 'descricao_fotos', 'Descricao das fotos', 'textarea'),
          (18, 'nf_fornecedor', 'NF e fornecedor', 'text'),
          (19, 'rgi_pde', 'RGI (PDE)', 'text'),
          (20, 'obra', 'Obra', 'text'),
          (21, 'numero_nc', 'N° da NC', 'text'),
          (22, 'posicao_rede', 'Posicao da rede', 'text'),
          (23, 'numero_croqui_rede', 'N° do croqui de rede', 'text')
      ),
      report_field_mapping (report_code, field_id, field_order) AS (
        VALUES
          ('ACEITE_PAVIMENTO', 2, 1), ('ACEITE_PAVIMENTO', 3, 2), ('ACEITE_PAVIMENTO', 4, 3), ('ACEITE_PAVIMENTO', 5, 4), ('ACEITE_PAVIMENTO', 6, 5),
          ('RECOMPOSICAO', 2, 1), ('RECOMPOSICAO', 3, 2), ('RECOMPOSICAO', 4, 3), ('RECOMPOSICAO', 5, 4), ('RECOMPOSICAO', 7, 5),
          ('REGULARIZACAO', 2, 1), ('REGULARIZACAO', 3, 2), ('REGULARIZACAO', 4, 3), ('REGULARIZACAO', 5, 4), ('REGULARIZACAO', 8, 5),
          ('MANUTENCAO_CANTEIRO', 2, 1),
          ('PV_TRANSICAO', 2, 1), ('PV_TRANSICAO', 3, 2), ('PV_TRANSICAO', 16, 3),
          ('OBRAS_CIVIS_EEE', 2, 1), ('OBRAS_CIVIS_EEE', 3, 2), ('OBRAS_CIVIS_EEE', 17, 3),
          ('FORNECIMENTO_EEE_LR', 1, 1), ('FORNECIMENTO_EEE_LR', 2, 2), ('FORNECIMENTO_EEE_LR', 3, 3), ('FORNECIMENTO_EEE_LR', 17, 4), ('FORNECIMENTO_EEE_LR', 18, 5), ('FORNECIMENTO_EEE_LR', 20, 6),
          ('MONTAGEM_EEE', 1, 1), ('MONTAGEM_EEE', 2, 2), ('MONTAGEM_EEE', 3, 3), ('MONTAGEM_EEE', 17, 4), ('MONTAGEM_EEE', 21, 5),
          ('LIMPEZA_REDE', 2, 1), ('LIMPEZA_REDE', 3, 2), ('LIMPEZA_REDE', 4, 3), ('LIMPEZA_REDE', 5, 4), ('LIMPEZA_REDE', 6, 5), ('LIMPEZA_REDE', 7, 6), ('LIMPEZA_REDE', 8, 7), ('LIMPEZA_REDE', 9, 8), ('LIMPEZA_REDE', 17, 9),
          ('REPARO_NCF', 11, 1), ('REPARO_NCF', 21, 2),
          ('LIGACOES', 2, 1), ('LIGACOES', 4, 2), ('LIGACOES', 19, 3), ('LIGACOES', 5, 4), ('LIGACOES', 6, 5), ('LIGACOES', 3, 6), ('LIGACOES', 9, 7), ('LIGACOES', 10, 8), ('LIGACOES', 8, 9), ('LIGACOES', 13, 10), ('LIGACOES', 15, 11), ('LIGACOES', 22, 12),
          ('LIGACAO_PASSEIO', 2, 1), ('LIGACAO_PASSEIO', 3, 2), ('LIGACAO_PASSEIO', 5, 3), ('LIGACAO_PASSEIO', 6, 4), ('LIGACAO_PASSEIO', 23, 5), ('LIGACAO_PASSEIO', 19, 6), ('LIGACAO_PASSEIO', 12, 7)
      )
      INSERT INTO "report_type_fields" (
        "report_type_id",
        "field_key",
        "label",
        "type",
        "required",
        "order",
        "placeholder",
        "options",
        "multiple"
      )
      SELECT
        rt.id,
        fd.field_key,
        fd.label,
        fd.field_type::report_field_type_enum,
        true,
        m.field_order,
        NULL,
        NULL,
        false
      FROM report_field_mapping m
      INNER JOIN "report_types" rt ON rt.code = m.report_code
      INNER JOIN field_dictionary fd ON fd.field_id = m.field_id
      ORDER BY rt.code, m.field_order
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "report_files" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "report_records" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "report_type_fields" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "report_types" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_field_type_enum"`);
  }
}
