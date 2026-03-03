import { MigrationInterface, QueryRunner } from 'typeorm';

export class ServiceOrdersTable1700000006000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "service_orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "os_number" character varying NOT NULL,
        "address" text NOT NULL,
        "field" boolean NOT NULL DEFAULT false,
        "remote" boolean NOT NULL DEFAULT false,
        "post_work" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_service_orders" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_service_orders_os_number" UNIQUE ("os_number")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "service_orders"`);
  }
}
