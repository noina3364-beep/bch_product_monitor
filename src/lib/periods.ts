import type { PeriodSelection, PeriodView } from '../types';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function formatDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function getStartOfWeek(date: Date) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + diff);
  return utc;
}

export function getCurrentReferenceDate() {
  return formatDateKey(new Date());
}

export function getCurrentPeriodSelection(): PeriodSelection {
  return {
    view: 'week',
    referenceDate: getCurrentReferenceDate(),
  };
}

export function toWeekStartKey(referenceDate: string) {
  return formatDateKey(getStartOfWeek(parseDateKey(referenceDate)));
}

export function getIncludedWeekKeys(view: PeriodView, referenceDate: string) {
  if (view === 'week') {
    return [toWeekStartKey(referenceDate)];
  }

  const reference = parseDateKey(referenceDate);

  if (view === 'mtd') {
    const month = reference.getUTCMonth();
    const year = reference.getUTCFullYear();
    const cursor = new Date(Date.UTC(year, month, 1));
    const weeks: string[] = [];

    while (cursor.getUTCMonth() === month) {
      if (cursor.getUTCDay() === 1) {
        weeks.push(formatDateKey(cursor));
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return weeks;
  }

  const year = reference.getUTCFullYear();
  const cursor = new Date(Date.UTC(year, 0, 1));
  const weeks: string[] = [];

  while (cursor.getUTCFullYear() === year) {
    if (cursor.getUTCDay() === 1) {
      weeks.push(formatDateKey(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return weeks;
}

export function getPeriodLabel(period: PeriodSelection) {
  if (period.view === 'week') {
    return `Week of ${toWeekStartKey(period.referenceDate)}`;
  }

  if (period.view === 'mtd') {
    return parseDateKey(period.referenceDate).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  return String(parseDateKey(period.referenceDate).getUTCFullYear());
}

export function toMonthInputValue(referenceDate: string) {
  return referenceDate.slice(0, 7);
}

export function monthInputToReferenceDate(monthValue: string) {
  return `${monthValue}-01`;
}

export function getYearValue(referenceDate: string) {
  return String(parseDateKey(referenceDate).getUTCFullYear());
}

export function yearValueToReferenceDate(yearValue: string) {
  return `${yearValue}-01-01`;
}
