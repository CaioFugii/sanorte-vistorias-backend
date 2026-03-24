import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeInspectionTeamOptionalForSt1700000019000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inspections"
      ALTER COLUMN "team_id" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM "inspections" WHERE "team_id" IS NULL) THEN
          RAISE EXCEPTION 'Não é possível reverter: existem inspeções sem team_id.';
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE "inspections"
      ALTER COLUMN "team_id" SET NOT NULL
    `);
  }
}
