import React, { useEffect, useMemo, useState } from 'react';
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import type { PeriodSelection, ProductCategoryKey, ProductCategoryState } from '../types';
import {
  getCellValue,
  getConversionRate,
  getFunnelTotals,
  getParentFunnel,
  getTargetDiff,
  getTargetValue,
  getWeekCellOrEmpty,
} from '../lib/productMetrics';
import { toWeekStartKey } from '../lib/periods';
import { cn, formatNumber, formatPercent } from '../lib/utils';
import { AutosizeTextarea } from './AutosizeTextarea';

interface ProductBoardProps {
  productId: string;
  categoryKey: ProductCategoryKey;
  categoryState: ProductCategoryState;
  period: PeriodSelection;
  canEditStructure: boolean;
  canEditValues: boolean;
  onUpdateCellData: (
    funnelId: string,
    channelId: string,
    field: 'visits' | 'revenue',
    value: number,
  ) => void;
  onUpdateFunnelTarget: (funnelId: string, value: number) => void;
  onUpdateFunnelParent: (funnelId: string, parentFunnelId: string | null) => void;
  onReorderFunnels: (funnelIds: string[]) => void;
  onAddFunnel: () => void;
  onRemoveFunnel: (funnelId: string, name: string) => void;
  onUpdateFunnelName: (funnelId: string, name: string) => void;
  onReorderChannels: (channelIds: string[]) => void;
  onAddChannel: () => void;
  onRemoveChannel: (channelId: string, name: string) => void;
  onUpdateChannelName: (channelId: string, name: string) => void;
}

interface SortableBoardChannelProps {
  channel: ProductCategoryState['channels'][number];
  canEdit: boolean;
  onUpdateName: (channelId: string, name: string) => void;
  onDeleteRequest: (channelId: string, name: string) => void;
}

const SortableBoardChannel: React.FC<SortableBoardChannelProps> = ({
  channel,
  canEdit,
  onUpdateName,
  onDeleteRequest,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: channel.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3"
    >
      {canEdit ? (
        <button
          type="button"
          className="mt-1 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
      ) : null}

      {canEdit ? (
        <AutosizeTextarea
          value={channel.name}
          onChange={(event) => onUpdateName(channel.id, event.target.value)}
          className="min-h-[34px] flex-1 resize-none rounded-lg bg-transparent px-2 py-1 text-sm font-semibold text-slate-700 outline-none transition focus:bg-slate-50 focus:ring-2 focus:ring-blue-100"
        />
      ) : (
        <div className="min-h-[34px] flex-1 px-2 py-1 text-sm font-semibold leading-snug text-slate-700 break-words">
          {channel.name}
        </div>
      )}

      {canEdit ? (
        <button
          type="button"
          onClick={() => onDeleteRequest(channel.id, channel.name)}
          className="mt-1 rounded p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 size={14} />
        </button>
      ) : null}
    </div>
  );
};

interface SortableBoardFunnelCardProps {
  productId: string;
  categoryState: ProductCategoryState;
  period: PeriodSelection;
  weekStartDate: string;
  funnel: ProductCategoryState['funnels'][number];
  canEditStructure: boolean;
  canEditValues: boolean;
  expanded: boolean;
  onToggleExpanded: (funnelId: string) => void;
  onUpdateName: (funnelId: string, name: string) => void;
  onUpdateTarget: (funnelId: string, value: number) => void;
  onUpdateParent: (funnelId: string, parentFunnelId: string | null) => void;
  onDeleteRequest: (funnelId: string, name: string) => void;
  onUpdateCellData: (
    funnelId: string,
    channelId: string,
    field: 'visits' | 'revenue',
    value: number,
  ) => void;
}

const SortableBoardFunnelCard: React.FC<SortableBoardFunnelCardProps> = ({
  productId,
  categoryState,
  period,
  weekStartDate,
  funnel,
  canEditStructure,
  canEditValues,
  expanded,
  onToggleExpanded,
  onUpdateName,
  onUpdateTarget,
  onUpdateParent,
  onDeleteRequest,
  onUpdateCellData,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: funnel.id,
  });
  const totals = getFunnelTotals(categoryState, period, funnel.id);
  const target = getTargetValue(funnel.targetVisits, period);
  const diff = getTargetDiff(totals.visits, target);
  const parentFunnel = getParentFunnel(categoryState, funnel.id);
  const conversion = getConversionRate(categoryState, period, funnel.id);

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex w-[360px] min-w-[360px] flex-col rounded-3xl border border-slate-200 bg-white shadow-sm',
        isDragging && 'shadow-2xl ring-2 ring-blue-200',
      )}
    >
      <div className="border-b border-slate-100 p-5">
        <div className="flex items-start gap-2">
          {canEditStructure ? (
            <button
              type="button"
              className="mt-1 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              {...attributes}
              {...listeners}
            >
              <GripVertical size={14} />
            </button>
          ) : null}

          {canEditStructure ? (
            <AutosizeTextarea
              value={funnel.name}
              onChange={(event) => onUpdateName(funnel.id, event.target.value)}
              className="min-h-[40px] flex-1 resize-none rounded-xl bg-transparent px-2 py-1 text-lg font-bold text-slate-900 outline-none transition focus:bg-slate-50 focus:ring-2 focus:ring-blue-100"
            />
          ) : (
            <div className="flex-1 px-2 py-1 text-lg font-bold leading-tight text-slate-900 break-words">
              {funnel.name}
            </div>
          )}

          {canEditStructure ? (
            <button
              type="button"
              onClick={() => onDeleteRequest(funnel.id, funnel.name)}
              className="mt-1 rounded p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Based On
            </label>
            {canEditStructure ? (
              <select
                value={funnel.parentFunnelId ?? ''}
                onChange={(event) => onUpdateParent(funnel.id, event.target.value || null)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">None</option>
                {categoryState.funnels
                  .filter((entry) => entry.id !== funnel.id)
                  .map((entry) => (
                    <option key={`${productId}-${funnel.id}-${entry.id}`} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
              </select>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                {parentFunnel?.name ?? 'None'}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Weekly Target
            </label>
            {canEditStructure ? (
              <input
                type="number"
                value={funnel.targetVisits}
                onChange={(event) => onUpdateTarget(funnel.id, parseInt(event.target.value, 10) || 0)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
              />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                {formatNumber(funnel.targetVisits)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-5">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Visits / Target</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-slate-900">{formatNumber(totals.visits)}</span>
            <span className="text-sm text-slate-400">/ {formatNumber(target)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Revenue</div>
          <div className="mt-2 text-2xl font-bold text-emerald-500">฿{formatNumber(totals.revenue)}</div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Conv from {parentFunnel?.name ?? '-'}
          </div>
          <div
            className={cn(
              'mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold',
              conversion === null ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-700',
            )}
          >
            {conversion === null ? '-' : formatPercent(conversion)}
          </div>
        </div>

        <div
          className={cn(
            'rounded-2xl border p-4',
            diff < 0 ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50',
          )}
        >
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vs Target</div>
          <div className={cn('mt-2 text-lg font-bold', diff < 0 ? 'text-red-500' : 'text-emerald-600')}>
            {diff > 0 ? '+' : ''}
            {formatPercent(diff)}
          </div>
        </div>
      </div>

      <div className="p-5">
        <button
          type="button"
          onClick={() => onToggleExpanded(funnel.id)}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Hide Channels' : 'Show Channels'}
        </button>

        {expanded ? (
          <div className="mt-4 space-y-3">
            {categoryState.channels.map((channel) => {
              const periodCell = getCellValue(categoryState, period, funnel.id, channel.id);
              const weeklyCell = getWeekCellOrEmpty(categoryState, weekStartDate, funnel.id, channel.id);
              const channelParent = getParentFunnel(categoryState, funnel.id);
              const channelConversion = getConversionRate(categoryState, period, funnel.id, channel.id);

              return (
                <div key={`${productId}-${categoryState.id}-${funnel.id}-${channel.id}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-snug text-slate-800 break-words">
                        {channel.name}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <span>Conv from {channelParent?.name ?? '-'}:</span>
                        <span
                          className={cn(
                            'rounded-md px-1.5 py-0.5 text-[11px] font-bold normal-case tracking-normal',
                            channelConversion === null ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-700',
                          )}
                        >
                          {channelConversion === null ? '-' : formatPercent(channelConversion)}
                        </span>
                      </div>
                    </div>
                    {!canEditValues && period.view !== 'week' ? (
                      <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        Derived
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Visits
                      </label>
                      {canEditValues ? (
                        <input
                          type="number"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                          value={weeklyCell.visits}
                          onChange={(event) =>
                            onUpdateCellData(
                              funnel.id,
                              channel.id,
                              'visits',
                              parseInt(event.target.value, 10) || 0,
                            )
                          }
                        />
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                          {formatNumber(periodCell.visits)}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Revenue (฿)
                      </label>
                      {canEditValues ? (
                        <input
                          type="number"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                          value={weeklyCell.revenue}
                          onChange={(event) =>
                            onUpdateCellData(
                              funnel.id,
                              channel.id,
                              'revenue',
                              parseInt(event.target.value, 10) || 0,
                            )
                          }
                        />
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                          ฿{formatNumber(periodCell.revenue)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </article>
  );
};

export const ProductBoard: React.FC<ProductBoardProps> = ({
  productId,
  categoryKey,
  categoryState,
  period,
  canEditStructure,
  canEditValues,
  onUpdateCellData,
  onUpdateFunnelTarget,
  onUpdateFunnelParent,
  onReorderFunnels,
  onAddFunnel,
  onRemoveFunnel,
  onUpdateFunnelName,
  onReorderChannels,
  onAddChannel,
  onRemoveChannel,
  onUpdateChannelName,
}) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const funnelIds = useMemo(() => categoryState.funnels.map((funnel) => funnel.id), [categoryState.funnels]);
  const channelIds = useMemo(() => categoryState.channels.map((channel) => channel.id), [categoryState.channels]);
  const [expandedFunnelIds, setExpandedFunnelIds] = useState<string[]>(funnelIds);
  const weekStartDate = toWeekStartKey(period.referenceDate);

  useEffect(() => {
    setExpandedFunnelIds(funnelIds);
  }, [funnelIds]);

  const handleFunnelDragEnd = (event: DragEndEvent) => {
    if (!canEditStructure) {
      return;
    }

    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = funnelIds.indexOf(String(active.id));
    const newIndex = funnelIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    void onReorderFunnels(arrayMove(funnelIds, oldIndex, newIndex));
  };

  const handleChannelDragEnd = (event: DragEndEvent) => {
    if (!canEditStructure) {
      return;
    }

    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = channelIds.indexOf(String(active.id));
    const newIndex = channelIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    void onReorderChannels(arrayMove(channelIds, oldIndex, newIndex));
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      {period.view !== 'week' ? (
        <div className="border-b border-amber-200 bg-amber-50 px-8 py-3 text-sm font-medium text-amber-900">
          Weekly input is the editable source data. {period.view.toUpperCase()} values shown here are derived rollups.
        </div>
      ) : null}

      <div className="flex-1 overflow-auto p-6">
        <div className="grid min-h-full grid-cols-[280px_1fr] gap-6">
          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                    {categoryKey === 'new' ? 'New Customer' : 'Existing Customer'}
                  </div>
                  <h3 className="mt-2 text-lg font-bold text-slate-900">Channel Directory</h3>
                </div>
                {canEditStructure ? (
                  <button
                    type="button"
                    onClick={onAddChannel}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-slate-800"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                ) : null}
              </div>

              <div className="mt-4">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleChannelDragEnd}>
                  <SortableContext items={channelIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {categoryState.channels.map((channel) => (
                        <SortableBoardChannel
                          key={channel.id}
                          channel={channel}
                          canEdit={canEditStructure}
                          onUpdateName={onUpdateChannelName}
                          onDeleteRequest={onRemoveChannel}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </aside>

          <section className="space-y-4 overflow-x-auto pb-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  Interactive Board
                </div>
                <h3 className="mt-2 text-lg font-bold text-slate-900">Funnels & Weekly Performance</h3>
              </div>
              {canEditStructure ? (
                <button
                  type="button"
                  onClick={onAddFunnel}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  <Plus size={15} />
                  Add Funnel
                </button>
              ) : null}
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFunnelDragEnd}>
              <SortableContext items={funnelIds} strategy={horizontalListSortingStrategy}>
                <div className="flex min-w-max gap-5 pb-3">
                  {categoryState.funnels.map((funnel) => (
                    <SortableBoardFunnelCard
                      key={funnel.id}
                      productId={productId}
                      categoryState={categoryState}
                      period={period}
                      weekStartDate={weekStartDate}
                      funnel={funnel}
                      canEditStructure={canEditStructure}
                      canEditValues={canEditValues}
                      expanded={expandedFunnelIds.includes(funnel.id)}
                      onToggleExpanded={(funnelId) =>
                        setExpandedFunnelIds((prev) =>
                          prev.includes(funnelId)
                            ? prev.filter((entry) => entry !== funnelId)
                            : [...prev, funnelId],
                        )
                      }
                      onUpdateName={onUpdateFunnelName}
                      onUpdateTarget={onUpdateFunnelTarget}
                      onUpdateParent={onUpdateFunnelParent}
                      onDeleteRequest={onRemoveFunnel}
                      onUpdateCellData={onUpdateCellData}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>
        </div>
      </div>
    </div>
  );
};
