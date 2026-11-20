import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveAdminAreasFromAccessProfiles1700000057000 implements MigrationInterface {
  name = 'RemoveAdminAreasFromAccessProfiles1700000057000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "access_profile_areas"
      WHERE "area" IN (
        'admin_usuarios',
        'admin_equipes',
        'admin_hierarquia',
        'admin_contratos',
        'admin_setores',
        'admin_colaboradores',
        'admin_checklists'
      )
    `);
  }

  public async down(): Promise<void> {
    // Administração deixou de fazer parte do Acesso; as linhas apagadas não voltam.
  }
}
