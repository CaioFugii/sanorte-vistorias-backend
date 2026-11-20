import {
  clampToCurrentMonth,
  monthDateRange,
  previousYearMonth,
  saoPauloYearMonth,
} from '../common/utils/sao-paulo-period';

export {
  clampToCurrentMonth,
  monthDateRange,
  previousYearMonth,
  referenceMonthFromRange,
  saoPauloYearMonth,
} from '../common/utils/sao-paulo-period';
export type { YearMonth } from '../common/utils/sao-paulo-period';

const SAO_PAULO = 'America/Sao_Paulo';

export function saoPauloToday(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

export function currentMonthToDate(date = new Date()): { from: string; to: string } {
  const { year, month } = saoPauloYearMonth(date);
  const mm = String(month).padStart(2, '0');
  return {
    from: `${year}-${mm}-01`,
    to: saoPauloToday(date),
  };
}

/**
 * Remoto usa o mês de referência (mês vigente da tela).
 * No mês calendário atual o intervalo vai do dia 1 até hoje; mês passado entra inteiro.
 * Pós-obra usa o mês anterior, sempre inteiro.
 * Mês futuro ou ausente cai no mês calendário atual.
 */
export function summaryPeriods(
  reference: { year: number; month: number } | undefined,
  now = new Date(),
): { remote: { from: string; to: string }; postWork: { from: string; to: string } } {
  const current = saoPauloYearMonth(now);
  const usable = clampToCurrentMonth(reference, now);
  const remote =
    usable.year === current.year && usable.month === current.month
      ? currentMonthToDate(now)
      : monthDateRange(usable.year, usable.month);
  const previous = previousYearMonth(usable.year, usable.month);
  return {
    remote,
    postWork: monthDateRange(previous.year, previous.month),
  };
}
