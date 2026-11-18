const SAO_PAULO = 'America/Sao_Paulo';

export function saoPauloYearMonth(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  return { year, month };
}

export function previousYearMonth(
  year: number,
  month: number,
): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

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

export function monthDateRange(
  year: number,
  month: number,
): { from: string; to: string } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

export type YearMonth = { year: number; month: number };

function leadingDate(value?: string): string | undefined {
  const match = value?.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1];
}

/** Mês do filtro da lista. Intervalo que cruza dois meses não define um mês. */
export function referenceMonthFromRange(
  from?: string,
  to?: string,
): YearMonth | undefined {
  const start = leadingDate(from);
  if (!start) return undefined;
  const end = leadingDate(to);
  if (end && start.slice(0, 7) !== end.slice(0, 7)) return undefined;
  const year = Number(start.slice(0, 4));
  const month = Number(start.slice(5, 7));
  if (month < 1 || month > 12) return undefined;
  return { year, month };
}

/**
 * Remoto usa o mês de referência (mês vigente da tela).
 * No mês calendário atual o intervalo vai do dia 1 até hoje; mês passado entra inteiro.
 * Pós-obra usa o mês anterior, sempre inteiro.
 * Mês futuro ou ausente cai no mês calendário atual.
 */
export function summaryPeriods(
  reference: YearMonth | undefined,
  now = new Date(),
): { remote: { from: string; to: string }; postWork: { from: string; to: string } } {
  const current = saoPauloYearMonth(now);
  const usable =
    reference &&
    reference.year * 12 + reference.month <= current.year * 12 + current.month
      ? reference
      : current;
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
