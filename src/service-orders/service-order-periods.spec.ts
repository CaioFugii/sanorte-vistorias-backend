import {
  currentMonthToDate,
  monthDateRange,
  previousYearMonth,
  referenceMonthFromRange,
  saoPauloYearMonth,
  summaryPeriods,
} from './service-order-periods';

describe('service order periods', () => {
  it('usa o calendário de São Paulo na virada do mês', () => {
    expect(saoPauloYearMonth(new Date('2026-03-01T02:30:00.000Z'))).toEqual({
      year: 2026,
      month: 2,
    });
    expect(saoPauloYearMonth(new Date('2026-03-01T03:30:00.000Z'))).toEqual({
      year: 2026,
      month: 3,
    });
  });

  it('o mês anterior de janeiro é dezembro do ano passado', () => {
    expect(previousYearMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });

  it('o mês vigente da caixa vai do dia 1 até hoje em São Paulo', () => {
    expect(currentMonthToDate(new Date('2026-11-17T02:30:00.000Z'))).toEqual({
      from: '2026-11-01',
      to: '2026-11-16',
    });
    expect(currentMonthToDate(new Date('2026-11-17T03:30:00.000Z'))).toEqual({
      from: '2026-11-01',
      to: '2026-11-17',
    });
  });
  it('as caixas seguem o mês escolhido e o mês anterior a ele', () => {
    const now = new Date('2026-11-18T15:00:00.000Z');
    expect(summaryPeriods({ year: 2026, month: 10 }, now)).toEqual({
      remote: { from: '2026-10-01', to: '2026-10-31' },
      postWork: { from: '2026-09-01', to: '2026-09-30' },
    });
    expect(summaryPeriods({ year: 2026, month: 1 }, now).postWork).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('no mês calendário atual o remoto vai só até hoje', () => {
    const now = new Date('2026-11-18T15:00:00.000Z');
    expect(summaryPeriods({ year: 2026, month: 11 }, now).remote).toEqual({
      from: '2026-11-01',
      to: '2026-11-18',
    });
    expect(summaryPeriods(undefined, now).remote.to).toBe('2026-11-18');
  });

  it('mês futuro ou intervalo que cruza meses não desloca as caixas', () => {
    const now = new Date('2026-11-18T15:00:00.000Z');
    expect(summaryPeriods({ year: 2026, month: 12 }, now).remote).toEqual({
      from: '2026-11-01',
      to: '2026-11-18',
    });
    expect(referenceMonthFromRange('2026-10-01', '2026-10-31')).toEqual({
      year: 2026,
      month: 10,
    });
    expect(referenceMonthFromRange('2026-10-01T00:00:00.000Z', '2026-10-31')).toEqual({
      year: 2026,
      month: 10,
    });
    expect(referenceMonthFromRange('2026-10-01', '2026-11-18')).toBeUndefined();
    expect(referenceMonthFromRange(undefined, '2026-10-31')).toBeUndefined();
  });

  it('fevereiro e meses de 31 dias fecham no último dia', () => {
    expect(monthDateRange(2026, 2)).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(monthDateRange(2024, 2).to).toBe('2024-02-29');
    expect(monthDateRange(2026, 11).to).toBe('2026-11-30');
  });
});
