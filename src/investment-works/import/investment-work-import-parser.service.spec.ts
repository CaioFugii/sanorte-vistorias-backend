import * as XLSX from 'xlsx';
import { InvestmentWorkImportParserService } from './investment-work-import-parser.service';

function workbook(rows: Record<string, unknown>[]): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Obras');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('InvestmentWorkImportParserService', () => {
  const service = new InvestmentWorkImportParserService();

  const row = (headers: Record<string, unknown>) =>
    service.parse(workbook([headers]))[0];

  it('lê cabeçalho com acento e sem acento, em qualquer caixa', () => {
    const accented = row({
      'O.S': 10,
      data: '2026-10-20',
      Descrição: 'Binder(B)',
      Endereço: 'Rua A',
      Bairro: 'Centro',
      'Equipe PDA': 'Equipe 1',
    });
    const plain = row({
      'o.s': 10,
      DATA: '2026-10-20',
      descricao: 'Binder(B)',
      endereço: 'Rua A',
      bairro: 'Centro',
      'equipe pda': 'Equipe 1',
    });

    expect(accented).toMatchObject({
      osNumber: '10',
      executionDate: '2026-10-20',
      description: 'Binder(B)',
      address: 'Rua A',
      district: 'Centro',
      pdaTeam: 'Equipe 1',
    });
    expect(plain).toMatchObject({
      osNumber: '10',
      descriptionKey: 'BINDER(B)',
      address: 'Rua A',
      district: 'Centro',
      pdaTeam: 'Equipe 1',
    });
  });

  it('lista as colunas ausentes pelo nome', () => {
    expect(() => service.parse(workbook([{ 'O.S': 1, Cidade: 'SP' }]))).toThrow(
      'Colunas ausentes: data, Descrição, Endereço, Bairro, Equipe PDA',
    );
  });

  it('converte data serial, brasileira e ISO, e recusa texto americano', () => {
    const rows = service.parse(
      workbook([
        {
          'O.S': 1,
          data: 46315,
          Descrição: 'A',
          Endereço: '',
          Bairro: '',
          'Equipe PDA': '',
        },
        {
          'O.S': 1,
          data: '20/10/2026',
          Descrição: 'A',
          Endereço: '',
          Bairro: '',
          'Equipe PDA': '',
        },
        {
          'O.S': 1,
          data: '2026-10-20',
          Descrição: 'A',
          Endereço: '',
          Bairro: '',
          'Equipe PDA': '',
        },
        {
          'O.S': 1,
          data: '10/20/26',
          Descrição: 'A',
          Endereço: '',
          Bairro: '',
          'Equipe PDA': '',
        },
      ]),
    );

    expect(rows.map((item) => item.executionDate)).toEqual([
      '2026-10-20',
      '2026-10-20',
      '2026-10-20',
      null,
    ]);
    expect(rows[3].dateError).toBe('data inválida');
  });

  it('grava a O.S numérica como texto e recusa acima do limite seguro', () => {
    const rows = service.parse(
      workbook([
        {
          'O.S': 17219247782,
          data: '2026-10-20',
          Descrição: 'A',
          Endereço: '',
          Bairro: '',
          'Equipe PDA': '',
        },
        {
          'O.S': Number.MAX_SAFE_INTEGER + 1,
          data: '2026-10-20',
          Descrição: 'A',
          Endereço: '',
          Bairro: '',
          'Equipe PDA': '',
        },
      ]),
    );

    expect(rows[0].osNumber).toBe('17219247782');
    expect(rows[0].osError).toBeNull();
    expect(rows[1].osNumber).toBeNull();
    expect(rows[1].osError).toBe('O.S acima do limite seguro');
  });

  it('normaliza a Descrição', () => {
    const parsed = row({
      'O.S': 1,
      data: '2026-10-20',
      Descrição: '  reposição   de asfalto ',
      Endereço: '',
      Bairro: '',
      'Equipe PDA': '',
    });

    expect(parsed.description).toBe('reposição   de asfalto');
    expect(parsed.descriptionKey).toBe('REPOSICAO DE ASFALTO');
  });
});
