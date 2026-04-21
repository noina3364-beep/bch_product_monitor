import React, { useEffect, useRef, useState } from 'react';
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
import { GripVertical, Plus, Trash2 } from 'lucide-react';
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

const FUNNEL_COLUMN_WIDTH = 300;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const ReadonlyField: React.FC<{ value: string | number; className?: string }> = ({ value, className }) => (
  <div className={cn('rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700', className)}>
    {value}
  </div>
);

interface ProductTableProps {
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
  onUpdateChannelColumnWidth: (width: number) => void;
}

interface SortableFunnelHeaderProps {
  productId: string;
  categoryState: ProductCategoryState;
  period: PeriodSelection;
  funnel: ProductCategoryState['funnels'][number];
  canEditStructure: boolean;
  onUpdateName: (funnelId: string, name: string) => void;
  onUpdateTarget: (funnelId: string, value: number) => void;
  onUpdateParent: (funnelId: string, parentFunnelId: string | null) => void;
  onDeleteRequest: (funnelId: string, name: string) => void;
}

const SortableFunnelHeader: React.FC<SortableFunnelHeaderProps> = ({
  productId,
  categoryState,
  funnel,
  canEditStructure,
  onUpdateName,
  onUpdateTarget,
  onUpdateParent,
  onDeleteRequest,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: funnel.id,
  });
  const parentLabel = categoryState.funnels.find((entry) => entry.id === funnel.parentFunnelId)?.name ?? 'None';

  return (
    <th
      ref={setNodeRef}
      style={{
        width: FUNNEL_COLUMN_WIDTH,
        minWidth: FUNNEL_COLUMN_WIDTH,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn('border-b border-slate-200 bg-slate-50 align-top', isDragging && 'z-20 shadow-xl')}
    >
      <div className="space-y-3 px-4 py-3 text-left">
        <div className="flex items-start gap-2">
          {canEditStructure ? (
            <button
              type="button"
              className="mt-1 rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
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
              className="min-h-[36px] w-full resize-none rounded-lg bg-transparent px-2 py-1 text-sm font-bold text-slate-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          ) : (
            <div className="min-h-[36px] flex-1 rounded-lg px-2 py-1 text-sm font-bold leading-snug text-slate-900 break-words">
              {funnel.name}
            </div>
          )}

          {canEditStructure ? (
            <button
              type="button"
              onClick={() => onDeleteRequest(funnel.id, funnel.name)}
              className="mt-1 rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Based On
          </label>
          {canEditStructure ? (
            <select
              value={funnel.parentFunnelId ?? ''}
              onChange={(event) => onUpdateParent(funnel.id, event.target.value || null)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
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
            <ReadonlyField value={parentLabel} className="text-xs" />
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Weekly Target Visits
          </label>
          {canEditStructure ? (
            <input
              type="number"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
              value={funnel.targetVisits}
              onChange={(event) => onUpdateTarget(funnel.id, parseInt(event.target.value, 10) || 0)}
            />
          ) : (
            <ReadonlyField value={formatNumber(funnel.targetVisits)} />
          )}
        </div>
      </div>
    </th>
  );
};

interface SortableChannelRowProps {
  productId: string;
  categoryState: ProductCategoryState;
  period: PeriodSelection;
  weekStartDate: string;
  channel: ProductCategoryState['channels'][number];
  channelColumnWidth: number;
  canEditStructure: boolean;
  canEditValues: boolean;
  onUpdateName: (channelId: string, name: string) => void;
  onDeleteRequest: (channelId: string, name: string) => void;
  onUpdateCellData: (
    funnelId: string,
    channelId: string,
    field: 'visits' | 'revenue',
    value: number,
  ) => void;
}

const SortableChannelRow: React.FC<SortableChannelRowProps> = ({
  productId,
  categoryState,
  period,
  weekStartDate,
  channel,
  channelColumnWidth,
  canEditStructure,
  canEditValues,
  onUpdateName,
  onDeleteRequest,
  onUpdateCellData,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: channel.id,
  });

  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn('group hover:bg-slate-50/70', isDragging && 'opacity-70')}
    >
      <td
        className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white align-top shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover:bg-slate-50/70"
        style={{ width: channelColumnWidth, minWidth: channelColumnWidth }}
      >
        <div className="flex items-start gap-2 px-4 py-3">
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
              value={channel.name}
              onChange={(event) => onUpdateName(channel.id, event.target.value)}
              className="min-h-[34px] w-full resize-none rounded-lg bg-transparent px-2 py-1 text-sm font-semibold text-slate-700 outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          ) : (
            <div className="min-h-[34px] flex-1 rounded-lg px-2 py-1 text-sm font-semibold leading-snug text-slate-700 break-words">
              {channel.name}
            </div>
          )}

          {canEditStructure ? (
            <button
              type="button"
              onClick={() => onDeleteRequest(channel.id, channel.name)}
              className="mt-1 rounded p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      </td>

      {categoryState.funnels.map((funnel) => {
        const periodCell = getCellValue(categoryState, period, funnel.id, channel.id);
        const weekCell = getWeekCellOrEmpty(categoryState, weekStartDate, funnel.id, channel.id);
        const parentFunnel = getParentFunnel(categoryState, funnel.id);
        const conversion = getConversionRate(categoryState, period, funnel.id, channel.id);

        return (
          <td key={`${productId}-${channel.id}-${funnel.id}`} className="border-b border-slate-100 p-3 align-top">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <span>Conv from {parentFunnel?.name ?? '-'}:</span>
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[11px] font-bold normal-case tracking-normal',
                      conversion === null ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-700',
                    )}
                  >
                    {conversion === null ? '-' : formatPercent(conversion)}
                  </span>
                </div>
                {!canEditValues && period.view !== 'week' ? (
                  <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    Derived
                  </span>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Visits
                  </label>
                  {canEditValues ? (
                    <input
                      type="number"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-400"
                      value={weekCell.visits}
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
                    <ReadonlyField value={formatNumber(periodCell.visits)} />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Revenue (฿)
                  </label>
                  {canEditValues ? (
                    <input
                      type="number"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-400"
                      value={weekCell.revenue}
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
                    <ReadonlyField value={`฿${formatNumber(periodCell.revenue)}`} />
                  )}
                </div>
              </div>
            </div>
          </td>
        );
      })}
    </tr>
  );
};

export const ProductTable: React.FC<ProductTableProps> = ({
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
  onUpdateChannelColumnWidth,
}) => {
  const [channelColumnWidth, setChannelColumnWidth] = useState(categoryState.layout.channelColumnWidth);
  const resizeWidthRef = useRef(channelColumnWidth);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const funnelIds = categoryState.funnels.map((funnel) => funnel.id);
  const channelIds = categoryState.channels.map((channel) => channel.id);
  const weekStartDate = toWeekStartKey(period.referenceDate);

  useEffect(() => {
    setChannelColumnWidth(categoryState.layout.channelColumnWidth);
    resizeWidthRef.current = categoryState.layout.channelColumnWidth;
  }, [categoryState.layout.channelColumnWidth, categoryKey]);

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

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!canEditStructure) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startWidth = channelColumnWidth;

    const handleMove = (moveEvent: MouseEvent) => {
      const nextWidth = clamp(startWidth + (moveEvent.clientX - startX), 180, 420);
      resizeWidthRef.current = nextWidth;
      setChannelColumnWidth(nextWidth);
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      void onUpdateChannelColumnWidth(resizeWidthRef.current);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      {period.view !== 'week' ? (
        <div className="border-b border-amber-200 bg-amber-50 px-8 py-3 text-sm font-medium text-amber-900">
          Weekly input is the editable source data. {period.view.toUpperCase()} values shown here are derived rollups.
        </div>
      ) : null}

      <div className="flex items-center justify-between border-b border-slate-100 bg-white px-8 py-4">
        <div className="text-sm font-semibold text-slate-500">
          Table view for the {categoryKey === 'new' ? 'New Customer' : 'Existing Customer'} graph
        </div>

        {canEditStructure ? (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onAddChannel}
              className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-slate-800"
            >
              <Plus size={16} />
              Add Channel
            </button>
            <button
              type="button"
              onClick={onAddFunnel}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700"
            >
              <Plus size={16} />
              Add Funnel
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="min-w-[980px] border-collapse">
          <thead>
            <tr>
              <th
                className="border-b border-r border-slate-200 bg-slate-50 p-0 align-top"
                style={{ width: channelColumnWidth, minWidth: channelColumnWidth }}
              >
                <div className="relative flex h-full items-center justify-between px-4 py-4">
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
                      Channels
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-slate-700">
                      {canEditStructure ? 'Independent category order' : 'Read-only view'}
                    </span>
                  </div>
                  {canEditStructure ? (
                    <div
                      onMouseDown={handleResizeStart}
                      className="absolute inset-y-0 right-0 w-3 cursor-col-resize bg-transparent"
                    />
                  ) : null}
                </div>
              </th>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFunnelDragEnd}>
                <SortableContext items={funnelIds} strategy={horizontalListSortingStrategy}>
                  {categoryState.funnels.map((funnel) => (
                    <SortableFunnelHeader
                      key={funnel.id}
                      productId={productId}
                      categoryState={categoryState}
                      period={period}
                      funnel={funnel}
                      canEditStructure={canEditStructure}
                      onUpdateName={onUpdateFunnelName}
                      onUpdateTarget={onUpdateFunnelTarget}
                      onUpdateParent={onUpdateFunnelParent}
                      onDeleteRequest={onRemoveFunnel}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </tr>

            <tr>
              <th
                className="border-r border-slate-800 bg-slate-900 p-4 text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]"
                style={{ width: channelColumnWidth, minWidth: channelColumnWidth }}
              >
                <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">Totals</span>
                <span className="mt-1 block text-sm font-bold text-white">Performance Summary</span>
              </th>

              {categoryState.funnels.map((funnel) => {
                const totals = getFunnelTotals(categoryState, period, funnel.id);
                const currentTarget = getTargetValue(funnel.targetVisits, period);
                const diff = getTargetDiff(totals.visits, currentTarget);
                const conversion = getConversionRate(categoryState, period, funnel.id);
                const parentFunnel = getParentFunnel(categoryState, funnel.id);

                return (
                  <th
                    key={`summary-${funnel.id}`}
                    className="bg-slate-900 p-4 text-left align-top font-normal"
                    style={{ width: FUNNEL_COLUMN_WIDTH, minWidth: FUNNEL_COLUMN_WIDTH }}
                  >
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Visits / Target
                          </span>
                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-lg font-bold text-white">{formatNumber(totals.visits)}</span>
                            <span className="text-xs text-slate-400">/ {formatNumber(currentTarget)}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            Revenue
                          </span>
                          <div className="mt-1 text-lg font-bold text-emerald-400">฿{formatNumber(totals.revenue)}</div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          Conv from {parentFunnel?.name ?? '-'}
                        </div>
                        <div
                          className={cn(
                            'mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold',
                            conversion === null ? 'bg-slate-700 text-slate-300' : 'bg-blue-500/15 text-blue-300',
                          )}
                        >
                          {conversion === null ? '-' : formatPercent(conversion)}
                        </div>
                      </div>

                      <div
                        className={cn(
                          'flex items-center justify-between rounded-xl border p-2',
                          diff < 0 ? 'border-red-500/20 bg-red-500/10' : 'border-emerald-500/20 bg-emerald-500/10',
                        )}
                      >
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Vs Target
                          </div>
                          <div className={cn('text-sm font-bold', diff < 0 ? 'text-red-400' : 'text-emerald-400')}>
                            {diff > 0 ? '+' : ''}
                            {formatPercent(diff)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleChannelDragEnd}>
            <SortableContext items={channelIds} strategy={verticalListSortingStrategy}>
              <tbody>
                {categoryState.channels.map((channel) => (
                  <SortableChannelRow
                    key={channel.id}
                    productId={productId}
                    categoryState={categoryState}
                    period={period}
                    weekStartDate={weekStartDate}
                    channel={channel}
                    channelColumnWidth={channelColumnWidth}
                    canEditStructure={canEditStructure}
                    canEditValues={canEditValues}
                    onUpdateName={onUpdateChannelName}
                    onDeleteRequest={onRemoveChannel}
                    onUpdateCellData={onUpdateCellData}
                  />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>
    </div>
  );
};
