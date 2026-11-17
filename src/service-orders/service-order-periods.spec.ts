import {
  currentMonthToDate,
  monthDateRange,
  previousYearMonth,
  saoPauloYearMonth,
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
  it('fevereiro e meses de 31 dias fecham no último dia', () => {
    expect(monthDateRange(2026, 2)).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(monthDateRange(2024, 2).to).toBe('2024-02-29');
    expect(monthDateRange(2026, 11).to).toBe('2026-11-30');
  });
});
