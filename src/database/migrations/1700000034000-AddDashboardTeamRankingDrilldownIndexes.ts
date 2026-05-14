import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDashboardTeamRankingDrilldownIndexes1700000034000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inspections_team_service_order_created_at_scored"
      ON "inspections"("team_id", "service_order_id", "created_at" DESC)
      WHERE "status" <> 'RASCUNHO' AND "score_percent" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inspections_team_module_service_order_scored"
      ON "inspections"("team_id", "module", "service_order_id")
      WHERE "status" <> 'RASCUNHO' AND "score_percent" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_service_orders_fim_execucao_id"
      ON "service_orders"("fim_execucao" DESC, "id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_service_orders_fim_execucao_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inspections_team_module_service_order_scored"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inspections_team_service_order_created_at_scored"`,
    );
  }
}
