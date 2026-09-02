import { MigrationInterface, QueryRunner } from 'typeorm';

const REPORT_CODE = 'LIGACAO_PASSEIO';
const FIELD_KEY = 'titulo_complemento';
const TITLE_OPTIONS = [
  'LIGAÇÃO DOMICILIAR TIPO 1 D.100MM',
  'LIGAÇÃO DOMICILIAR TIPO 1 D.150MM',
  'LIGAÇÃO DOMICILIAR TIPO 1 D.100MM E RECOMPOSIÇÃO DE PASSEIO',
  'LIGAÇÃO DOMICILIAR TIPO 1 D.150MM E RECOMPOSIÇÃO DE PASSEIO',
  'RECOMPOSIÇÃO DE PASSEIO',
] as const;

export class AddLigacaoPasseioTitleComplement1700000040000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const optionsJson = JSON.stringify(
      TITLE_OPTIONS.map((entry) => ({ label: entry, value: entry })),
    );

    await queryRunner.query(
      `
      WITH report AS (
        SELECT id
        FROM "report_types"
        WHERE code = $1
        LIMIT 1
      ),
      existing AS (
        SELECT 1
        FROM "report_type_fields" f
        INNER JOIN report r ON r.id = f.report_type_id
        WHERE f.field_key = $2
      ),
      preco AS (
        SELECT f."order" AS preco_order
        FROM "report_type_fields" f
        INNER JOIN report r ON r.id = f.report_type_id
        WHERE f.field_key = 'preco'
        LIMIT 1
      ),
      shifted AS (
        UPDATE "report_type_fields" f
        SET "order" = f."order" + 1,
            updated_at = NOW()
        FROM report r, preco p
        WHERE f.report_type_id = r.id
          AND f."order" > p.preco_order
          AND NOT EXISTS (SELECT 1 FROM existing)
        RETURNING f.id
      )
      INSERT INTO "report_type_fields" (
        "report_type_id",
        "field_key",
        "label",
        "type",
        "required",
        "order",
        "placeholder",
        "help_text",
        "options",
        "default_value",
        "multiple"
      )
      SELECT
        r.id,
        $2,
        'Complemento do título',
        'select'::report_field_type_enum,
        true,
        COALESCE((SELECT preco_order FROM preco), (
          SELECT COALESCE(MAX(f."order"), 0)
          FROM "report_type_fields" f
          WHERE f.report_type_id = r.id
        )) + 1,
        NULL,
        NULL,
        $3::jsonb,
        $4,
        false
      FROM report r
      WHERE NOT EXISTS (SELECT 1 FROM existing)
      `,
      [REPORT_CODE, FIELD_KEY, optionsJson, TITLE_OPTIONS[0]],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      WITH report AS (
        SELECT id
        FROM "report_types"
        WHERE code = $1
        LIMIT 1
      ),
      removed AS (
        DELETE FROM "report_type_fields" f
        USING report r
        WHERE f.report_type_id = r.id
          AND f.field_key = $2
        RETURNING f."order" AS removed_order, f.report_type_id
      )
      UPDATE "report_type_fields" f
      SET "order" = f."order" - 1,
          updated_at = NOW()
      FROM removed
      WHERE f.report_type_id = removed.report_type_id
        AND f."order" > removed.removed_order
      `,
      [REPORT_CODE, FIELD_KEY],
    );
  }
}
