import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModuleTypeEnumPosObraSemAcento1700000009000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Cria novo tipo com POS_OBRA (sem acento) no lugar de PÓS_OBRA
    await queryRunner.query(`
      CREATE TYPE "module_type_enum_new" AS ENUM(
        'SEGURANCA_TRABALHO',
        'OBRAS_INVESTIMENTO',
        'OBRAS_GLOBAL',
        'CANTEIRO',
        'QUALIDADE',
        'CAMPO',
        'REMOTO',
        'POS_OBRA'
      )
    `);

    // Converte coluna em checklists: mapeia PÓS_OBRA -> POS_OBRA
    await queryRunner.query(`
      ALTER TABLE "checklists"
      ALTER COLUMN "module" TYPE "module_type_enum_new"
      USING (
        CASE WHEN "module"::text = 'PÓS_OBRA'
        THEN 'POS_OBRA'::"module_type_enum_new"
        ELSE "module"::text::"module_type_enum_new"
        END
      )
    `);

    // Converte coluna em inspections: mapeia PÓS_OBRA -> POS_OBRA
    await queryRunner.query(`
      ALTER TABLE "inspections"
      ALTER COLUMN "module" TYPE "module_type_enum_new"
      USING (
        CASE WHEN "module"::text = 'PÓS_OBRA'
        THEN 'POS_OBRA'::"module_type_enum_new"
        ELSE "module"::text::"module_type_enum_new"
        END
      )
    `);

    // Remove tipo antigo e renomeia o novo
    await queryRunner.query(`DROP TYPE "module_type_enum"`);
    await queryRunner.query(`
      ALTER TYPE "module_type_enum_new" RENAME TO "module_type_enum"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Cria tipo reverso com PÓS_OBRA (com acento)
    await queryRunner.query(`
      CREATE TYPE "module_type_enum_old" AS ENUM(
        'SEGURANCA_TRABALHO',
        'OBRAS_INVESTIMENTO',
        'OBRAS_GLOBAL',
        'CANTEIRO',
        'QUALIDADE',
        'CAMPO',
        'REMOTO',
        'PÓS_OBRA'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "checklists"
      ALTER COLUMN "module" TYPE "module_type_enum_old"
      USING (
        CASE WHEN "module"::text = 'POS_OBRA'
        THEN 'PÓS_OBRA'::"module_type_enum_old"
        ELSE "module"::text::"module_type_enum_old"
        END
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "inspections"
      ALTER COLUMN "module" TYPE "module_type_enum_old"
      USING (
        CASE WHEN "module"::text = 'POS_OBRA'
        THEN 'PÓS_OBRA'::"module_type_enum_old"
        ELSE "module"::text::"module_type_enum_old"
        END
      )
    `);

    await queryRunner.query(`DROP TYPE "module_type_enum"`);
    await queryRunner.query(`
      ALTER TYPE "module_type_enum_old" RENAME TO "module_type_enum"
    `);
  }
}
