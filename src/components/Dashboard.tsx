import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductContextV2';
import { cn, formatNumber, formatPercent } from '../lib/utils';
import { Users, TrendingUp, Package } from 'lucide-react';

interface ReadonlyValueProps {
  value: number;
  prefix?: string;
}

const ReadonlyValue: React.FC<ReadonlyValueProps> = ({ value, prefix = '' }) => (
  <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-lg font-bold text-slate-900">
    {prefix}{formatNumber(value)}
  </div>
);

export const Dashboard: React.FC = () => {
  const { isEditor } = useAuth();
  const { products, globalTargets, updateGlobalTargets } = useProducts();

  // Calculate actuals from all products
  const globalActuals = products.reduce((acc, p) => {
    let productRevenue = 0;
    let productNewVisits = 0;
    let productExistingVisits = 0;

    Object.values(p.data.newChannels).forEach(funnel => {
      Object.values(funnel).forEach(channel => {
        productRevenue += channel.revenue;
        productNewVisits += channel.visits;
      });
    });

    Object.values(p.data.existingChannels).forEach(funnel => {
      Object.values(funnel).forEach(channel => {
        productRevenue += channel.revenue;
        productExistingVisits += channel.visits;
      });
    });

    acc.revenue += productRevenue;
    acc.newVisits += productNewVisits;
    acc.existingVisits += productExistingVisits;
    
    return acc;
  }, { revenue: 0, newVisits: 0, existingVisits: 0 });

  // Calculate product-wise breakdown
  const productBreakdown = products.map(p => {
    let revenue = 0;
    let newVisits = 0;
    let existingVisits = 0;

    Object.values(p.data.newChannels).forEach(funnel => {
      Object.values(funnel).forEach(channel => {
        revenue += channel.revenue;
        newVisits += channel.visits;
      });
    });

    Object.values(p.data.existingChannels).forEach(funnel => {
      Object.values(funnel).forEach(channel => {
        revenue += channel.revenue;
        existingVisits += channel.visits;
      });
    });

    return {
      id: p.id,
      name: p.name,
      revenue,
      newVisits,
      existingVisits
    };
  });

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Target Section with Logo */}
        <div className="grid grid-cols-[208px_1fr_1fr_1fr] gap-6 items-center px-6">
          {/* Logo Area */}
          <div className="flex items-center justify-center pr-6">
            <img 
              src="/images/Chan.png" 
              alt="Bangkok Hospital Chanthaburi" 
              className="h-16 w-full object-contain"
            />
          </div>

          {/* Revenue Target */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3">
            <div className="flex items-center gap-3 text-blue-600">
              <TrendingUp size={18} />
              <h3 className="font-bold uppercase text-[10px] tracking-widest">Target Revenue</h3>
            </div>
            <div className="space-y-1">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">฿</span>
                <input 
                  type="number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 font-bold text-lg text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={globalTargets.revenue}
                  onChange={(e) => updateGlobalTargets({ revenue: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex justify-between items-end px-1">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Actual</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-bold text-emerald-600">฿{formatNumber(globalActuals.revenue)}</span>
                    <span className={cn(
                      "text-[10px] font-bold px-1 rounded",
                      globalActuals.revenue >= globalTargets.revenue ? "text-emerald-600 bg-emerald-50" : "text-red-500 bg-red-50"
                    )}>
                      {globalTargets.revenue > 0 ? (globalActuals.revenue >= globalTargets.revenue ? '+' : '') + (((globalActuals.revenue - globalTargets.revenue) / globalTargets.revenue) * 100).toFixed(1) + '%' : '0%'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min((globalActuals.revenue / globalTargets.revenue) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* New Customers Target */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3">
            <div className="flex items-center gap-3 text-indigo-600">
              <Users size={18} />
              <h3 className="font-bold uppercase text-[10px] tracking-widest">Target New Customers</h3>
            </div>
            <div className="space-y-1">
              <input 
                type="number"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-lg text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={globalTargets.newCustomers}
                onChange={(e) => updateGlobalTargets({ newCustomers: parseInt(e.target.value) || 0 })}
              />
              <div className="flex justify-between items-end px-1">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Actual</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-bold text-indigo-600">{formatNumber(globalActuals.newVisits)}</span>
                    <span className={cn(
                      "text-[10px] font-bold px-1 rounded",
                      globalActuals.newVisits >= globalTargets.newCustomers ? "text-emerald-600 bg-emerald-50" : "text-red-500 bg-red-50"
                    )}>
                      {globalTargets.newCustomers > 0 ? (globalActuals.newVisits >= globalTargets.newCustomers ? '+' : '') + (((globalActuals.newVisits - globalTargets.newCustomers) / globalTargets.newCustomers) * 100).toFixed(1) + '%' : '0%'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min((globalActuals.newVisits / globalTargets.newCustomers) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Existing Customers Target */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3">
            <div className="flex items-center gap-3 text-purple-600">
              <Users size={18} />
              <h3 className="font-bold uppercase text-[10px] tracking-widest">Target Existing Customers</h3>
            </div>
            <div className="space-y-1">
              <input 
                type="number"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold text-lg text-slate-900 outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                value={globalTargets.existingCustomers}
                onChange={(e) => updateGlobalTargets({ existingCustomers: parseInt(e.target.value) || 0 })}
              />
              <div className="flex justify-between items-end px-1">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Actual</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-bold text-purple-600">{formatNumber(globalActuals.existingVisits)}</span>
                    <span className={cn(
                      "text-[10px] font-bold px-1 rounded",
                      globalActuals.existingVisits >= globalTargets.existingCustomers ? "text-emerald-600 bg-emerald-50" : "text-red-500 bg-red-50"
                    )}>
                      {globalTargets.existingCustomers > 0 ? (globalActuals.existingVisits >= globalTargets.existingCustomers ? '+' : '') + (((globalActuals.existingVisits - globalTargets.existingCustomers) / globalTargets.existingCustomers) * 100).toFixed(1) + '%' : '0%'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                <div 
                  className="bg-purple-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min((globalActuals.existingVisits / globalTargets.existingCustomers) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Product Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="text-slate-400" />
              <h2 className="text-lg font-bold text-slate-900">Product Performance Breakdown</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-full">
              {/* Table Header */}
              <div className="bg-slate-50 border-b border-slate-100">
                <div className="grid grid-cols-[208px_1fr_1fr_1fr] gap-6 px-6 py-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Product Name</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sum Revenue</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sum New Visits</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sum Existing Visits</div>
                </div>
              </div>
              
              {/* Table Body */}
              <div className="divide-y divide-slate-100">
                {productBreakdown.map((p) => (
                  <div key={p.id} className="grid grid-cols-[208px_1fr_1fr_1fr] gap-6 px-6 py-4 hover:bg-slate-50/50 transition-colors items-center">
                    <div className="font-bold leading-snug break-words text-slate-900">{p.name}</div>
                    
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-600">฿{formatNumber(p.revenue)}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded border border-emerald-100">
                        {formatPercent(globalActuals.revenue > 0 ? p.revenue / globalActuals.revenue : 0)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-indigo-600">{formatNumber(p.newVisits)}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100">
                        {formatPercent(globalActuals.newVisits > 0 ? p.newVisits / globalActuals.newVisits : 0)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-purple-600">{formatNumber(p.existingVisits)}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded border border-purple-100">
                        {formatPercent(globalActuals.existingVisits > 0 ? p.existingVisits / globalActuals.existingVisits : 0)}
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
