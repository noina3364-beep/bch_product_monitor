import React from 'react';
import { Package, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductContextV2';
import { cn, formatNumber, formatPercent } from '../lib/utils';

interface TargetCardProps {
  accentClassName: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  actual: number;
  progressClassName: string;
  prefix?: string;
  onChange?: (value: number) => void;
}

const TargetCard: React.FC<TargetCardProps> = ({
  accentClassName,
  icon,
  label,
  value,
  actual,
  progressClassName,
  prefix = '',
  onChange,
}) => {
  const delta = value > 0 ? (actual - value) / value : 0;
  const progressWidth = value > 0 ? Math.min((actual / value) * 100, 100) : 0;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className={cn('flex items-center gap-3', accentClassName)}>
        {icon}
        <h3 className="text-[10px] font-bold uppercase tracking-widest">{label}</h3>
      </div>

      <div className="space-y-1">
        {onChange ? (
          <div className="relative">
            {prefix ? (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                {prefix}
              </span>
            ) : null}
            <input
              type="number"
              className={cn(
                'w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3 text-lg font-bold text-slate-900 outline-none transition-all',
                prefix ? 'pl-7' : 'px-3',
                accentClassName.includes('blue')
                  ? 'focus:ring-2 focus:ring-blue-500'
                  : accentClassName.includes('indigo')
                    ? 'focus:ring-2 focus:ring-indigo-500'
                    : 'focus:ring-2 focus:ring-purple-500',
              )}
              value={value}
              onChange={(event) => onChange(parseInt(event.target.value, 10) || 0)}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-lg font-bold text-slate-900">
            {prefix}{formatNumber(value)}
          </div>
        )}

        <div className="flex justify-between px-1">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold uppercase text-slate-400">Actual</span>
            <div className="flex items-center gap-1.5">
              <span className={cn('text-base font-bold', accentClassName)}>
                {prefix}{formatNumber(actual)}
              </span>
              <span
                className={cn(
                  'rounded px-1 text-[10px] font-bold',
                  actual >= value ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500',
                )}
              >
                {value > 0 ? `${actual >= value ? '+' : ''}${(delta * 100).toFixed(1)}%` : '0%'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={cn('h-full transition-all duration-500', progressClassName)} style={{ width: `${progressWidth}%` }} />
        </div>
      </div>
    </div>
  );
};

export const DashboardAuth: React.FC = () => {
  const { isEditor } = useAuth();
  const { products, globalTargets, updateGlobalTargets } = useProducts();

  const globalActuals = products.reduce(
    (acc, product) => {
      Object.values(product.data.newChannels).forEach((funnel) => {
        Object.values(funnel).forEach((channel) => {
          acc.revenue += channel.revenue;
          acc.newVisits += channel.visits;
        });
      });

      Object.values(product.data.existingChannels).forEach((funnel) => {
        Object.values(funnel).forEach((channel) => {
          acc.revenue += channel.revenue;
          acc.existingVisits += channel.visits;
        });
      });

      return acc;
    },
    { revenue: 0, newVisits: 0, existingVisits: 0 },
  );

  const productBreakdown = products.map((product) => {
    let revenue = 0;
    let newVisits = 0;
    let existingVisits = 0;

    Object.values(product.data.newChannels).forEach((funnel) => {
      Object.values(funnel).forEach((channel) => {
        revenue += channel.revenue;
        newVisits += channel.visits;
      });
    });

    Object.values(product.data.existingChannels).forEach((funnel) => {
      Object.values(funnel).forEach((channel) => {
        revenue += channel.revenue;
        existingVisits += channel.visits;
      });
    });

    return {
      id: product.id,
      name: product.name,
      revenue,
      newVisits,
      existingVisits,
    };
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="grid grid-cols-[208px_1fr_1fr_1fr] items-center gap-6 px-6">
          <div className="flex items-center justify-center pr-6">
            <img
              src="/images/Chan.png"
              alt="Bangkok Hospital Chanthaburi"
              className="h-16 w-full object-contain"
            />
          </div>

          <TargetCard
            accentClassName="text-blue-600"
            icon={<TrendingUp size={18} />}
            label="Target Revenue"
            value={globalTargets.revenue}
            actual={globalActuals.revenue}
            progressClassName="bg-emerald-500"
            prefix="฿"
            onChange={isEditor ? (value) => updateGlobalTargets({ revenue: value }) : undefined}
          />

          <TargetCard
            accentClassName="text-indigo-600"
            icon={<Users size={18} />}
            label="Target New Customers"
            value={globalTargets.newCustomers}
            actual={globalActuals.newVisits}
            progressClassName="bg-indigo-500"
            onChange={isEditor ? (value) => updateGlobalTargets({ newCustomers: value }) : undefined}
          />

          <TargetCard
            accentClassName="text-purple-600"
            icon={<Users size={18} />}
            label="Target Existing Customers"
            value={globalTargets.existingCustomers}
            actual={globalActuals.existingVisits}
            progressClassName="bg-purple-500"
            onChange={isEditor ? (value) => updateGlobalTargets({ existingCustomers: value }) : undefined}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-6">
            <div className="flex items-center gap-3">
              <Package className="text-slate-400" />
              <h2 className="text-lg font-bold text-slate-900">Product Performance Breakdown</h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-full">
              <div className="border-b border-slate-100 bg-slate-50">
                <div className="grid grid-cols-[208px_1fr_1fr_1fr] gap-6 px-6 py-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Product Name</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sum Revenue</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sum New Visits</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sum Existing Visits</div>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {productBreakdown.map((product) => (
                  <div
                    key={product.id}
                    className="grid grid-cols-[208px_1fr_1fr_1fr] items-center gap-6 px-6 py-4 transition-colors hover:bg-slate-50/50"
                  >
                    <div className="break-words font-bold leading-snug text-slate-900">{product.name}</div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-600">฿{formatNumber(product.revenue)}</span>
                      <span className="rounded border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                        {formatPercent(globalActuals.revenue > 0 ? product.revenue / globalActuals.revenue : 0)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-indigo-600">{formatNumber(product.newVisits)}</span>
                      <span className="rounded border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">
                        {formatPercent(globalActuals.newVisits > 0 ? product.newVisits / globalActuals.newVisits : 0)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-purple-600">{formatNumber(product.existingVisits)}</span>
                      <span className="rounded border border-purple-100 bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-600">
                        {formatPercent(
                          globalActuals.existingVisits > 0 ? product.existingVisits / globalActuals.existingVisits : 0,
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
