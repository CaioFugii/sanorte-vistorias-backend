import { MigrationInterface, QueryRunner } from 'typeorm';

export class ServiceOrderResultIdentifier1700000054000
  implements MigrationInterface
{
  name = 'ServiceOrderResultIdentifier1700000054000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "service_orders" so
      SET "service_identifier" = upper(trim(coalesce(so."resultado", '')))
      FROM "sectors" s
      WHERE so."sector_id" = s."id"
        AND s."name" <> 'REPOSICAO'
        AND coalesce(so."service_identifier", '') = ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "service_orders" so
      SET "service_identifier" = ''
      FROM "sectors" s
      WHERE so."sector_id" = s."id"
        AND s."name" <> 'REPOSICAO'
        AND NOT EXISTS (
          SELECT 1
          FROM "service_orders" other
          WHERE other."id" <> so."id"
            AND other."contract_id" IS NOT DISTINCT FROM so."contract_id"
            AND other."os_number" = so."os_number"
            AND other."sector_id" = so."sector_id"
        )
    `);
  }
}
