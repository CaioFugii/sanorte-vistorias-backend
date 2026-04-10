import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeInspectionServiceDescriptionOptionalForRemote1700000024000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inspections"
      ALTER COLUMN "service_description" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "inspections"
      SET "service_description" = 'Sem descrição'
      WHERE "service_description" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "inspections"
      ALTER COLUMN "service_description" SET NOT NULL
    `);
  }
}
