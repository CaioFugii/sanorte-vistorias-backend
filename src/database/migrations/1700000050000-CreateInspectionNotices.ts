import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInspectionNotices1700000050000 implements MigrationInterface {
  name = 'CreateInspectionNotices1700000050000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "inspection_notice_type_enum" AS ENUM(
        'RESOLUTION_SUBMITTED',
        'RESOLUTION_APPROVED',
        'RESOLUTION_REJECTED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "inspection_notices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "recipient_user_id" uuid NOT NULL,
        "inspection_id" uuid NOT NULL,
        "type" "inspection_notice_type_enum" NOT NULL,
        "message" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "read_at" TIMESTAMP,
        CONSTRAINT "PK_inspection_notices" PRIMARY KEY ("id"),
        CONSTRAINT "FK_inspection_notices_recipient"
          FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_inspection_notices_inspection"
          FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_inspection_notices_recipient_unread"
      ON "inspection_notices" ("recipient_user_id")
      WHERE "read_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_inspection_notices_recipient_unread"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "inspection_notices"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "inspection_notice_type_enum"`);
  }
}
