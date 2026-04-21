import React from 'react';
import type { PeriodSelection } from '../types';
import {
  getPeriodLabel,
  getYearValue,
  monthInputToReferenceDate,
  toMonthInputValue,
  yearValueToReferenceDate,
} from '../lib/periods';
import { cn } from '../lib/utils';

interface PeriodSelectorProps {
  period: PeriodSelection;
  availableYears: number[];
  onChange: (period: PeriodSelection) => void;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  period,
  availableYears,
  onChange,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        {(['week', 'mtd', 'ytd'] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => onChange({ ...period, view })}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors',
              period.view === view ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {view === 'mtd' ? 'MTD' : view === 'ytd' ? 'YTD' : 'Week'}
          </button>
        ))}
      </div>

      {period.view === 'week' ? (
        <input
          type="date"
          value={period.referenceDate}
          onChange={(event) => onChange({ ...period, referenceDate: event.target.value })}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
        />
      ) : null}

      {period.view === 'mtd' ? (
        <input
          type="month"
          value={toMonthInputValue(period.referenceDate)}
          onChange={(event) =>
            onChange({ ...period, referenceDate: monthInputToReferenceDate(event.target.value) })
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
        />
      ) : null}

      {period.view === 'ytd' ? (
        <select
          value={getYearValue(period.referenceDate)}
          onChange={(event) =>
            onChange({ ...period, referenceDate: yearValueToReferenceDate(event.target.value) })
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {period.view === 'week' ? getPeriodLabel(period) : `${period.view.toUpperCase()} ${getPeriodLabel(period)}`}
      </div>
    </div>
  );
};
