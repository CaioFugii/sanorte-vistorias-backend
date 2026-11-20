import {
  clampToCurrentMonth,
  monthDateRange,
  previousYearMonth,
} from './sao-paulo-period';

describe('sao paulo period', () => {
  const now = new Date('2026-11-18T15:00:00.000Z');

  it('o mês anterior de janeiro é dezembro do ano passado', () => {
    expect(previousYearMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
    expect(monthDateRange(2025, 12)).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('o mês atual entra inteiro, do dia 1 ao último dia', () => {
    const month = clampToCurrentMonth({ year: 2026, month: 11 }, now);
    expect(monthDateRange(month.year, month.month)).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    });
  });

  it('mês futuro cai no mês atual e continua inteiro', () => {
    const month = clampToCurrentMonth({ year: 2026, month: 12 }, now);
    expect(monthDateRange(month.year, month.month)).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(clampToCurrentMonth(undefined, now)).toEqual({
      year: 2026,
      month: 11,
    });
  });
});
