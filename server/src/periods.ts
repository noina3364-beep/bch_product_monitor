import type { PeriodView } from './constants.js';

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

export function toWeekStartKey(referenceDate: string) {
  return formatDateKey(getStartOfWeek(parseDateKey(referenceDate)));
}

export function getCurrentWeekStartKey() {
  return formatDateKey(getStartOfWeek(new Date()));
}

function getMondaysInMonth(referenceDate: string) {
  const reference = parseDateKey(referenceDate);
  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth();
  const cursor = new Date(Date.UTC(year, month, 1));
  const mondays: string[] = [];

  while (cursor.getUTCMonth() === month) {
    if (cursor.getUTCDay() === 1) {
      mondays.push(formatDateKey(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return mondays;
}

function getMondaysInYear(referenceDate: string) {
  const reference = parseDateKey(referenceDate);
  const year = reference.getUTCFullYear();
  const cursor = new Date(Date.UTC(year, 0, 1));
  const mondays: string[] = [];

  while (cursor.getUTCFullYear() === year) {
    if (cursor.getUTCDay() === 1) {
      mondays.push(formatDateKey(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return mondays;
}

export function getIncludedWeekKeys(view: PeriodView, referenceDate: string) {
  if (view === 'week') {
    return [toWeekStartKey(referenceDate)];
  }

  if (view === 'mtd') {
    return getMondaysInMonth(referenceDate);
  }

  return getMondaysInYear(referenceDate);
}

export function getMonthLabel(referenceDate: string) {
  return parseDateKey(referenceDate).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function getYearLabel(referenceDate: string) {
  return String(parseDateKey(referenceDate).getUTCFullYear());
}

export function getPeriodLabel(view: PeriodView, referenceDate: string) {
  if (view === 'week') {
    return `Week of ${toWeekStartKey(referenceDate)}`;
  }

  if (view === 'mtd') {
    return `MTD ${getMonthLabel(referenceDate)}`;
  }

  return `YTD ${getYearLabel(referenceDate)}`;
}
