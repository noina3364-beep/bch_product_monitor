import React, { useState } from 'react';
import { useProducts } from '../context/ProductContext';
import { CategoryType } from '../types';
import { cn, formatNumber, formatPercent } from '../lib/utils';
import { Plus, X, Settings2, ArrowRight } from 'lucide-react';

export const MonitoringTable: React.FC = () => {
  const {
    activeProduct,
    updateCellData,
    updateFunnelTarget,
    addFunnel,
    removeFunnel,
    updateFunnelName,
    addChannel,
    removeChannel,
    updateChannelName
  } = useProducts();

  const [activeCategory, setActiveCategory] = useState<CategoryType>('newChannels');

  if (!activeProduct) return null;

  const { funnels, channels, data } = activeProduct;

  // Calculations
  const getFunnelTotals = (category: CategoryType, funnelId: string) => {
    let visits = 0;
    let revenue = 0;
    channels.forEach(channel => {
      const cell = data[category][funnelId]?.[channel.id];
      if (cell) {
        visits += cell.visits || 0;
        revenue += cell.revenue || 0;
      }
    });
    return { visits, revenue };
  };

  const getConversionRate = (category: CategoryType, currentFunnelIdx: number, channelId?: string) => {
    if (currentFunnelIdx === 0) return null;

    if (channelId) {
      const current = data[category][funnels[currentFunnelIdx].id]?.[channelId]?.visits || 0;
      const previous = data[category][funnels[currentFunnelIdx - 1].id]?.[channelId]?.visits || 0;
      if (previous === 0) return 0;
      return current / previous;
    }

    const current = getFunnelTotals(category, funnels[currentFunnelIdx].id);
    const previous = getFunnelTotals(category, funnels[currentFunnelIdx - 1].id);
    if (previous.visits === 0) return 0;
    return current.visits / previous.visits;
  };

  const getTargetDiff = (actual: number, target: number) => {
    if (target === 0) return 0;
    return (actual - target) / target;
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Table Header / Tabs */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-slate-100 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveCategory('newChannels')}
            className={cn(
              "px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
              activeCategory === 'newChannels'
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            New Customer
          </button>
          <button
            onClick={() => setActiveCategory('existingChannels')}
            className={cn(
              "px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
              activeCategory === 'existingChannels'
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            Existing Customer
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => addChannel(activeProduct.id, 'New Channel')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all"
          >
            <Plus size={16} />
            Add Channel
          </button>
          <button
            onClick={() => addFunnel(activeProduct.id, 'New Funnel')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all"
          >
            <Plus size={16} />
            Add Funnel
          </button>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 overflow-auto relative">
        <table className="w-full border-collapse table-fixed min-w-[800px]">
          <thead>
            {/* Funnel Headers */}
            <tr className="bg-slate-50/50">
              {/* Channel Label Header */}
              <th className="sticky left-0 top-0 z-30 w-52 p-0 bg-slate-50 border-r border-b border-slate-200">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Channels</span>
                  <Settings2 size={14} className="text-slate-400" />
                </div>
              </th>

              {funnels.map((funnel, idx) => (
                <React.Fragment key={funnel.id}>
                  {idx > 0 && (
                    <th className="w-12 bg-slate-50 border-b border-slate-200 sticky top-0 z-20" />
                  )}
                  <th className="w-48 p-0 bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                    <div className="px-4 py-3 flex flex-col gap-1.5 text-left">
                      <div className="flex items-center justify-between group">
                        <input
                          className="bg-transparent font-bold text-slate-900 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 rounded px-1 -ml-1 w-full"
                          value={funnel.name}
                          onChange={(e) => updateFunnelName(activeProduct.id, funnel.id, e.target.value)}
                        />
                        <button
                          onClick={() => removeFunnel(activeProduct.id, funnel.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                          {activeCategory === 'newChannels' ? 'New Target Visits' : 'Existing Target Visits'}
                        </label>
                        <input
                          type="number"
                          className="bg-white border border-slate-200 rounded-md px-2 py-0.5 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                          value={funnel.targets[activeCategory]}
                          onChange={(e) =>
                            updateFunnelTarget(
                              activeProduct.id,
                              activeCategory,
                              funnel.id,
                              parseInt(e.target.value) || 0,
                            )
                          }
                        />
                      </div>
                    </div>
                  </th>
                </React.Fragment>
              ))}
            </tr>

            {/* Performance Summary Row */}
            <tr className="bg-slate-900 text-white">
              <th className="sticky left-0 top-[86px] z-30 w-52 p-4 bg-slate-900 border-r border-slate-800 text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Totals</span>
                <span className="text-sm font-bold block leading-tight">Performance Summary</span>
              </th>

              {funnels.map((funnel, idx) => {
                const totals = getFunnelTotals(activeCategory, funnel.id);
                const currentTarget = funnel.targets[activeCategory];
                const diff = getTargetDiff(totals.visits, currentTarget);
                const isNegative = diff < 0;

                return (
                  <React.Fragment key={`summary-${funnel.id}`}>
                    {idx > 0 && (
                      <th className="w-12 bg-slate-900 border-slate-800 sticky top-[86px] z-20">
                        <div className="flex flex-col items-center gap-0.5">
                          <ArrowRight size={10} className="text-slate-500" />
                          <span className="text-[9px] font-bold text-blue-400 bg-blue-400/10 px-1 rounded">
                            {formatPercent(getConversionRate(activeCategory, idx) || 0)}
                          </span>
                        </div>
                      </th>
                    )}
                    <th className="w-48 p-3 bg-slate-900 border-slate-800 text-left font-normal sticky top-[86px] z-20">
                      <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-bold text-slate-500 uppercase">Visits / Target</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-base font-bold">{formatNumber(totals.visits)}</span>
                              <span className="text-[11px] text-slate-400">/ {formatNumber(currentTarget)}</span>
                            </div>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[8px] font-bold text-slate-500 uppercase">Revenue</span>
                            <span className="text-base font-bold text-emerald-400">฿{formatNumber(totals.revenue)}</span>
                          </div>
                        </div>

                        <div className={cn(
                          "flex items-center justify-between p-1.5 rounded-lg border",
                          isNegative ? "bg-red-500/10 border-red-500/20" : "bg-blue-500/10 border-blue-500/20"
                        )}>
                          <div className="flex flex-col">
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Vs Target</span>
                            <span className={cn(
                              "text-xs font-bold",
                              isNegative ? "text-red-400" : "text-blue-400"
                            )}>
                              {diff > 0 ? '+' : ''}{formatPercent(diff)}
                            </span>
                          </div>
                          <div className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center",
                            isNegative ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"
                          )}>
                            <span className="text-[10px] font-black">{isNegative ? '!' : '✓'}</span>
                          </div>
                        </div>
                      </div>
                    </th>
                  </React.Fragment>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {channels.map((channel) => (
              <tr key={channel.id} className="group hover:bg-slate-50/50 transition-colors">
                {/* Sticky Channel Label */}
                <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-b border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                  <div className="px-4 py-3 flex items-center justify-between group/label">
                    <input
                      className="bg-transparent font-semibold text-slate-700 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 rounded px-1 -ml-1 w-full"
                      value={channel.name}
                      onChange={(e) => updateChannelName(activeProduct.id, channel.id, e.target.value)}
                    />
                    <button
                      onClick={() => removeChannel(activeProduct.id, channel.id)}
                      className="opacity-0 group-hover/label:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>

                {/* Funnel Data Cells */}
                {funnels.map((funnel, idx) => {
                  const cellData = data[activeCategory][funnel.id]?.[channel.id] || { visits: 0, revenue: 0 };
                  const convRate = getConversionRate(activeCategory, idx, channel.id);

                  return (
                    <React.Fragment key={`${channel.id}-${funnel.id}`}>
                      {idx > 0 && (
                        <td className="w-12 border-b border-slate-100 relative">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <ArrowRight size={10} className="text-slate-300" />
                              <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1 rounded">
                                {formatPercent(convRate || 0)}
                              </span>
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="p-2 border-b border-slate-100">
                        <div className="flex flex-col gap-2 p-2 bg-slate-50/30 rounded-lg border border-transparent group-hover:border-slate-200 transition-all">
                          <div className="flex flex-col gap-0.5">
                            <label className="text-[8px] font-bold text-slate-400 uppercase">Visits</label>
                            <input
                              type="number"
                              className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                              value={cellData.visits}
                              onChange={(e) => updateCellData(activeProduct.id, activeCategory, funnel.id, channel.id, 'visits', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <label className="text-[8px] font-bold text-slate-400 uppercase">Revenue (฿)</label>
                            <input
                              type="number"
                              className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                              value={cellData.revenue}
                              onChange={(e) => updateCellData(activeProduct.id, activeCategory, funnel.id, channel.id, 'revenue', parseInt(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};
