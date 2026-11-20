import { getMetadataArgsStorage } from 'typeorm';
import {
  InvestmentWork,
  InvestmentWorkDescription,
  InvestmentWorkImport,
  InvestmentWorkImportLine,
} from './index';

function column(target: Function, propertyName: string) {
  return getMetadataArgsStorage().columns.find(
    (item) => item.target === target && item.propertyName === propertyName,
  );
}

function relation(target: Function, propertyName: string) {
  return getMetadataArgsStorage().relations.find(
    (item) => item.target === target && item.propertyName === propertyName,
  );
}

describe('entidades de obra e importação', () => {
  it('a obra aceita equipe, bacia, serviço e rede vazios e nasce manual', () => {
    expect(column(InvestmentWork, 'teamId')?.options.nullable).toBe(true);
    expect(column(InvestmentWork, 'basin')?.options.nullable).toBe(true);
    expect(column(InvestmentWork, 'service')?.options.nullable).toBe(true);
    expect(column(InvestmentWork, 'materialNetwork')?.options.nullable).toBe(true);
    expect(column(InvestmentWork, 'origin')?.options.default).toBe('MANUAL');
    expect(relation(InvestmentWork, 'import')?.options.onDelete).toBe('SET NULL');
    expect(relation(InvestmentWork, 'sector')?.options.onDelete).toBe('RESTRICT');
  });

  it('a Descrição permanece depois que a obra é excluída', () => {
    expect(column(InvestmentWorkDescription, 'investmentWorkId')?.options.nullable).toBe(
      true,
    );
    expect(relation(InvestmentWorkDescription, 'investmentWork')?.options.onDelete).toBe(
      'SET NULL',
    );
  });

  it('a linha não registrada sai junto com o lançamento', () => {
    expect(relation(InvestmentWorkImportLine, 'import')?.options.onDelete).toBe(
      'CASCADE',
    );
    expect(column(InvestmentWorkImport, 'selectedDescriptions')?.options.type).toBe(
      'jsonb',
    );
  });
});
