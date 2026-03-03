import { MigrationInterface, QueryRunner } from 'typeorm';

export class ModuleTypeEnumNewValues1700000008000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "module_type_enum" ADD VALUE IF NOT EXISTS 'CAMPO'
    `);
    await queryRunner.query(`
      ALTER TYPE "module_type_enum" ADD VALUE IF NOT EXISTS 'REMOTO'
    `);
    await queryRunner.query(`
      ALTER TYPE "module_type_enum" ADD VALUE IF NOT EXISTS 'PÓS_OBRA'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL não permite remover valores de ENUM diretamente.
    // Os valores permanecem no tipo; remoção exigiria recriar o tipo e
    // alterar todas as colunas que o utilizam.
    // Nenhuma ação no down para preservar compatibilidade.
  }
}
