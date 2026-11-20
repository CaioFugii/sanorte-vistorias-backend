const SAO_PAULO = 'America/Sao_Paulo';

export type YearMonth = { year: number; month: number };

export function saoPauloYearMonth(date: Date): YearMonth {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  return { year, month };
}

export function previousYearMonth(year: number, month: number): YearMonth {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
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

/** Mês futuro ou ausente cai no mês calendário atual. Mês passado permanece. */
export function clampToCurrentMonth(
  reference: YearMonth | undefined,
  now = new Date(),
): YearMonth {
  const current = saoPauloYearMonth(now);
  if (
    !reference ||
    reference.year * 12 + reference.month > current.year * 12 + current.month
  ) {
    return current;
  }
  return reference;
}
