import { MigrationInterface, QueryRunner } from 'typeorm';

const PRECO_OPTIONS = [
  { label: '402001', value: '402001' },
  { label: '402002', value: '402002' },
  { label: '402003', value: '402003' },
  { label: '402004', value: '402004' },
];

export class NormalizeLigacaoPasseioPrecoOptions1700000041000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      UPDATE "report_type_fields" f
      SET
        options = $2::jsonb,
        updated_at = NOW()
      FROM "report_types" t
      WHERE t.id = f.report_type_id
        AND t.code = $1
        AND f.field_key = 'preco'
      `,
      ['LIGACAO_PASSEIO', JSON.stringify(PRECO_OPTIONS)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      UPDATE "report_type_fields" f
      SET
        options = $2::jsonb,
        updated_at = NOW()
      FROM "report_types" t
      WHERE t.id = f.report_type_id
        AND t.code = $1
        AND f.field_key = 'preco'
      `,
      [
        'LIGACAO_PASSEIO',
        JSON.stringify([
          {
            label: '402001',
            value: '402001 LIGAÇÃO DOMICILIAR TIPO 1 D. 100MM',
          },
          {
            label: '402002',
            value: '402002 LIGAÇÕES DOMICILIAR ESGOTO D.100MM TIPO 2',
          },
          {
            label: '402003',
            value: '402003 LIGAÇÕES DOMICILIAR ESGOTO D.150MM TIPO 1',
          },
          {
            label: '402004',
            value: '402004 LIGAÇÕES DOMICILIAR ESGOTO D.150MM TIPO 2',
          },
        ]),
      ],
    );
  }
}
