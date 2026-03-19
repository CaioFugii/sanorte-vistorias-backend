import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeServiceOrderExecutionColumns1700000014000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "service_orders"
      ADD COLUMN IF NOT EXISTS "tempo_execucao_efetivo_segundos" integer NULL
    `);

    await queryRunner.query(`
      UPDATE "service_orders"
      SET "tempo_execucao_efetivo_segundos" = CASE
        WHEN "tempo_execucao_efetivo" IS NULL THEN NULL
        WHEN btrim("tempo_execucao_efetivo") = '' THEN NULL
        WHEN btrim("tempo_execucao_efetivo") ~ '^[+-]?\\s*\\d+\\s+\\d{1,2}:\\d{2}:\\d{2}$' THEN
          (
            CASE
              WHEN left(btrim("tempo_execucao_efetivo"), 1) = '-' THEN -1
              ELSE 1
            END
            *
            (
              (regexp_match(btrim("tempo_execucao_efetivo"), '^[+-]?\\s*(\\d+)\\s+(\\d{1,2}):(\\d{2}):(\\d{2})$'))[1]::int * 86400
              + (regexp_match(btrim("tempo_execucao_efetivo"), '^[+-]?\\s*(\\d+)\\s+(\\d{1,2}):(\\d{2}):(\\d{2})$'))[2]::int * 3600
              + (regexp_match(btrim("tempo_execucao_efetivo"), '^[+-]?\\s*(\\d+)\\s+(\\d{1,2}):(\\d{2}):(\\d{2})$'))[3]::int * 60
              + (regexp_match(btrim("tempo_execucao_efetivo"), '^[+-]?\\s*(\\d+)\\s+(\\d{1,2}):(\\d{2}):(\\d{2})$'))[4]::int
            )
          )
        WHEN btrim("tempo_execucao_efetivo") ~ '^[+-]?\\s*\\d{1,2}:\\d{2}:\\d{2}$' THEN
          (
            CASE
              WHEN left(btrim("tempo_execucao_efetivo"), 1) = '-' THEN -1
              ELSE 1
            END
            *
            (
              (regexp_match(btrim("tempo_execucao_efetivo"), '^[+-]?\\s*(\\d{1,2}):(\\d{2}):(\\d{2})$'))[1]::int * 3600
              + (regexp_match(btrim("tempo_execucao_efetivo"), '^[+-]?\\s*(\\d{1,2}):(\\d{2}):(\\d{2})$'))[2]::int * 60
              + (regexp_match(btrim("tempo_execucao_efetivo"), '^[+-]?\\s*(\\d{1,2}):(\\d{2}):(\\d{2})$'))[3]::int
            )
          )
        ELSE NULL
      END
    `);

    await queryRunner.query(`
      ALTER TABLE "service_orders"
      ALTER COLUMN "fim_execucao" TYPE timestamp
      USING (
        CASE
          WHEN "fim_execucao" IS NULL THEN NULL
          WHEN btrim("fim_execucao") = '' THEN NULL
          WHEN btrim("fim_execucao") ~ '^\\d{2}/\\d{2}/\\d{4}\\s+\\d{2}:\\d{2}(:\\d{2})?$' THEN
            to_timestamp(
              btrim("fim_execucao"),
              CASE
                WHEN btrim("fim_execucao") ~ ':\\d{2}$' THEN 'DD/MM/YYYY HH24:MI:SS'
                ELSE 'DD/MM/YYYY HH24:MI'
              END
            )::timestamp
          ELSE NULL
        END
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "service_orders"
      ALTER COLUMN "fim_execucao" TYPE text
      USING (
        CASE
          WHEN "fim_execucao" IS NULL THEN NULL
          ELSE to_char("fim_execucao", 'DD/MM/YYYY HH24:MI:SS')
        END
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "service_orders"
      DROP COLUMN IF EXISTS "tempo_execucao_efetivo_segundos"
    `);
  }
}
