import {
  InvestmentWorkImportLineStatus,
  InvestmentWorkOrigin,
} from './index';

describe('enums de importação de obras de investimento', () => {
  it('distingue cadastro manual de cadastro por Excel', () => {
    expect(InvestmentWorkOrigin.MANUAL).toBe('MANUAL');
    expect(InvestmentWorkOrigin.IMPORT).toBe('IMPORT');
  });

  it('grava só o status de linha não registrada', () => {
    expect(InvestmentWorkImportLineStatus.NOT_REGISTERED).toBe('NOT_REGISTERED');
    expect(Object.values(InvestmentWorkImportLineStatus)).toEqual([
      'NOT_REGISTERED',
    ]);
  });
});
