import { MigrationInterface, QueryRunner } from 'typeorm';

const FIELD_KEY = 'data_emissao';

export class AddReportEmissionDateField1700000043000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      WITH targets AS (
        SELECT rt.id AS report_type_id
        FROM "report_types" rt
        WHERE NOT EXISTS (
          SELECT 1
          FROM "report_type_fields" f
          WHERE f.report_type_id = rt.id
            AND f.field_key = $1
        )
      ),
      shifted AS (
        UPDATE "report_type_fields" f
        SET "order" = f."order" + 1,
            updated_at = NOW()
        FROM targets t
        WHERE f.report_type_id = t.report_type_id
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
        t.report_type_id,
        $1,
        'Data de emissão',
        'date'::report_field_type_enum,
        true,
        1,
        NULL,
        NULL,
        NULL,
        NULL,
        false
      FROM targets t
      `,
      [FIELD_KEY],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      WITH removed AS (
        DELETE FROM "report_type_fields" f
        WHERE f.field_key = $1
        RETURNING f.report_type_id, f."order" AS removed_order
      )
      UPDATE "report_type_fields" f
      SET "order" = f."order" - 1,
          updated_at = NOW()
      FROM removed
      WHERE f.report_type_id = removed.report_type_id
        AND f."order" > removed.removed_order
      `,
      [FIELD_KEY],
    );
  }
}
