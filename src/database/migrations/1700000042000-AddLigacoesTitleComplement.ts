import { MigrationInterface, QueryRunner } from 'typeorm';

const REPORT_CODE = 'LIGACOES';
const FIELD_KEY = 'titulo_complemento';
const TITLE_OPTIONS = [
  'LIGAÇÃO DOMICILIAR DE ESGOTO D100MM TIPO 1 – CONEXÃO POSTERIOR',
  'LIGAÇÃO DOMICILIAR DE ESGOTO D150MM TIPO 1 – CONEXÃO POSTERIOR',
] as const;

const PRECO_OPTIONS = [
  { label: '402006', value: '402006' },
  { label: '402032', value: '402032' },
  { label: '402005', value: '402005' },
  { label: '402033', value: '402033' },
  { label: '410904', value: '410904' },
  { label: '410905', value: '410905' },
];

export class AddLigacoesTitleComplement1700000042000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      UPDATE "report_type_fields" f
      SET
        options = $2::jsonb,
        updated_at = NOW()
      FROM "report_types" t
      WHERE t.id = f.report_type_id
        AND t.code = $1
        AND f.field_key = 'preco'
      `,
      [REPORT_CODE, JSON.stringify(PRECO_OPTIONS)],
    );

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

    await queryRunner.query(
      `
      UPDATE "report_type_fields" f
      SET
        options = $2::jsonb,
        updated_at = NOW()
      FROM "report_types" t
      WHERE t.id = f.report_type_id
        AND t.code = $1
        AND f.field_key = 'preco'
      `,
      [
        REPORT_CODE,
        JSON.stringify([
          { label: '402006', value: '402006 CONEXÃO POSTERIOR D.100MM' },
          { label: '402032', value: '402032 CONEXÃO POSTERIOR D.150MM' },
          { label: '402005', value: '402005 LIGAÇÃO EM ESPERA' },
          { label: '402033', value: '402033 LIGAÇÃO AVULSA' },
          { label: '410904', value: '410904 INSPEÇÃO LIG-ESGOTO-VARREDURA' },
          { label: '410905', value: '410905 INSPEÇÃO LIG-ESGOTO-AVULSA' },
        ]),
      ],
    );
  }
}
