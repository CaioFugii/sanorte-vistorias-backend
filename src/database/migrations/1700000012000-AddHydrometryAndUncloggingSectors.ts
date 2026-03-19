import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHydrometryAndUncloggingSectors1700000012000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "sectors" ("name", "active", "created_at", "updated_at")
      VALUES
        ('HIDROMETRIA', true, now(), now()),
        ('DESOBSTRUCAO', true, now(), now())
      ON CONFLICT ("name") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "sectors" s
      WHERE s."name" IN ('HIDROMETRIA', 'DESOBSTRUCAO')
        AND NOT EXISTS (
          SELECT 1
          FROM "service_orders" so
          WHERE so."sector_id" = s."id"
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "collaborators" c
          WHERE c."sector_id" = s."id"
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "checklists" ch
          WHERE ch."sector_id" = s."id"
        )
    `);
  }
}
