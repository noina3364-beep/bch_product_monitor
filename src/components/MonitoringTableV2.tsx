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
import { useProducts } from '../context/ProductContextV2';
import { CategoryType, FunnelStage } from '../types';
import { cn, formatNumber, formatPercent } from '../lib/utils';
import { AutosizeTextarea } from './AutosizeTextarea';
import { ConfirmationDialog } from './ConfirmationDialog';

const FUNNEL_COLUMN_WIDTH = 280;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

interface SortableFunnelHeaderProps {
  productId: string;
  funnel: FunnelStage;
  activeCategory: CategoryType;
  allFunnels: FunnelStage[];
  onUpdateName: (funnelId: string, name: string) => void;
  onUpdateTarget: (funnelId: string, value: number) => void;
  onUpdateParent: (funnelId: string, parentFunnelId: string | null) => void;
  onDeleteRequest: (funnelId: string, name: string) => void;
}

const SortableFunnelHeader: React.FC<SortableFunnelHeaderProps> = ({
  productId,
  funnel,
  activeCategory,
  allFunnels,
  onUpdateName,
  onUpdateTarget,
  onUpdateParent,
  onDeleteRequest,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: funnel.id,
  });

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
          <button
            type="button"
            className="mt-1 rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
          <AutosizeTextarea
            value={funnel.name}
            onChange={(event) => onUpdateName(funnel.id, event.target.value)}
            className="min-h-[36px] w-full resize-none rounded-lg bg-transparent px-2 py-1 text-sm font-bold text-slate-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
          <button
            onClick={() => onDeleteRequest(funnel.id, funnel.name)}
            className="mt-1 rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Based On
          </label>
          <select
            value={funnel.parentFunnelId ?? ''}
            onChange={(event) => onUpdateParent(funnel.id, event.target.value || null)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">None</option>
            {allFunnels
              .filter((entry) => entry.id !== funnel.id)
              .map((entry) => (
                <option key={`${productId}-${funnel.id}-${entry.id}`} value={entry.id}>
                  {entry.name}
                </option>
              ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {activeCategory === 'newChannels' ? 'New Target Visits' : 'Existing Target Visits'}
          </label>
          <input
            type="number"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
            value={funnel.targets[activeCategory]}
            onChange={(event) => onUpdateTarget(funnel.id, parseInt(event.target.value, 10) || 0)}
          />
        </div>
      </div>
    </th>
  );
};

interface SortableChannelRowProps {
  productId: string;
  channel: { id: string; name: string };
  funnels: FunnelStage[];
  activeCategory: CategoryType;
  channelColumnWidth: number;
  getCellData: (funnelId: string, channelId: string) => { visits: number; revenue: number };
  getChannelConversionMeta: (funnelId: string, channelId: string) => {
    parentName: string | null;
    rate: number | null;
  };
  onUpdateName: (channelId: string, name: string) => void;
  onDeleteRequest: (channelId: string, name: string) => void;
  onUpdateCellData: (funnelId: string, channelId: string, field: 'visits' | 'revenue', value: number) => void;
}

const SortableChannelRow: React.FC<SortableChannelRowProps> = ({
  productId,
  channel,
  funnels,
  activeCategory,
  channelColumnWidth,
  getCellData,
  getChannelConversionMeta,
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
          <button
            type="button"
            className="mt-1 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
          <AutosizeTextarea
            value={channel.name}
            onChange={(event) => onUpdateName(channel.id, event.target.value)}
            className="min-h-[34px] w-full resize-none rounded-lg bg-transparent px-2 py-1 text-sm font-semibold text-slate-700 outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
          <button
            onClick={() => onDeleteRequest(channel.id, channel.name)}
            className="mt-1 rounded p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>

      {funnels.map((funnel) => {
        const cellData = getCellData(funnel.id, channel.id);
        const conversion = getChannelConversionMeta(funnel.id, channel.id);

        return (
          <td key={`${productId}-${channel.id}-${funnel.id}-${activeCategory}`} className="border-b border-slate-100 p-3 align-top">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <span>
                    Conv from {conversion.parentName ?? '-'}:
                  </span>
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[11px] font-bold normal-case tracking-normal',
                      conversion.rate === null
                        ? 'bg-slate-200 text-slate-500'
                        : 'bg-blue-100 text-blue-700',
                    )}
                  >
                    {conversion.rate === null ? '-' : formatPercent(conversion.rate)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Visits
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-400"
                    value={cellData.visits}
                    onChange={(event) =>
                      onUpdateCellData(
                        funnel.id,
                        channel.id,
                        'visits',
                        parseInt(event.target.value, 10) || 0,
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Revenue (฿)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-400"
                    value={cellData.revenue}
                    onChange={(event) =>
                      onUpdateCellData(
                        funnel.id,
                        channel.id,
                        'revenue',
                        parseInt(event.target.value, 10) || 0,
                      )
                    }
                  />
                </div>
              </div>
            </div>
          </td>
        );
      })}
    </tr>
  );
};

export const MonitoringTable: React.FC = () => {
  const {
    activeProduct,
    updateCellData,
    updateFunnelTarget,
    updateFunnelParent,
    reorderFunnels,
    addFunnel,
    removeFunnel,
    updateFunnelName,
    reorderChannels,
    addChannel,
    removeChannel,
    updateChannelName,
    updateChannelColumnWidth,
  } = useProducts();
  const [activeCategory, setActiveCategory] = useState<CategoryType>('newChannels');
  const [pendingDelete, setPendingDelete] = useState<{ type: 'funnel' | 'channel'; id: string; name: string } | null>(null);
  const [channelColumnWidth, setChannelColumnWidth] = useState(208);
  const resizeWidthRef = useRef(channelColumnWidth);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (activeProduct) {
      setChannelColumnWidth(activeProduct.layout.channelColumnWidth);
      resizeWidthRef.current = activeProduct.layout.channelColumnWidth;
    }
  }, [activeProduct]);

  if (!activeProduct) return null;

  const { funnels, channels, data } = activeProduct;
  const funnelIds = funnels.map((funnel) => funnel.id);
  const channelIds = channels.map((channel) => channel.id);

  const getCellData = (funnelId: string, channelId: string) =>
    data[activeCategory][funnelId]?.[channelId] || { visits: 0, revenue: 0 };

  const getFunnelTotals = (funnelId: string) =>
    channels.reduce(
      (totals, channel) => {
        const cell = getCellData(funnelId, channel.id);
        totals.visits += cell.visits;
        totals.revenue += cell.revenue;
        return totals;
      },
      { visits: 0, revenue: 0 },
    );

  const getParentFunnel = (funnelId: string) => {
    const funnel = funnels.find((entry) => entry.id === funnelId);
    return funnel?.parentFunnelId ? funnels.find((entry) => entry.id === funnel.parentFunnelId) ?? null : null;
  };

  const getConversionRate = (funnelId: string, channelId?: string) => {
    const parentFunnel = getParentFunnel(funnelId);
    if (!parentFunnel) {
      return null;
    }

    if (channelId) {
      const current = getCellData(funnelId, channelId).visits;
      const previous = getCellData(parentFunnel.id, channelId).visits;
      if (previous === 0) return 0;
      return current / previous;
    }

    const current = getFunnelTotals(funnelId).visits;
    const previous = getFunnelTotals(parentFunnel.id).visits;
    if (previous === 0) return 0;
    return current / previous;
  };

  const getConversionLabel = (funnelId: string, channelId?: string) => {
    const parentFunnel = getParentFunnel(funnelId);
    if (!parentFunnel) {
      return 'Conv from -';
    }

    const rate = getConversionRate(funnelId, channelId);
    return `Conv from ${parentFunnel.name}: ${rate === null ? '-' : formatPercent(rate)}`;
  };

  const getConversionMeta = (funnelId: string, channelId?: string) => {
    const parentFunnel = getParentFunnel(funnelId);
    return {
      parentName: parentFunnel?.name ?? null,
      rate: getConversionRate(funnelId, channelId),
    };
  };

  const getTargetDiff = (actual: number, target: number) => {
    if (target === 0) return 0;
    return (actual - target) / target;
  };

  const handleFunnelDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = funnelIds.indexOf(String(active.id));
    const newIndex = funnelIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    reorderFunnels(activeProduct.id, arrayMove(funnelIds, oldIndex, newIndex));
  };

  const handleChannelDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = channelIds.indexOf(String(active.id));
    const newIndex = channelIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    reorderChannels(activeProduct.id, arrayMove(channelIds, oldIndex, newIndex));
  };

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
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
      updateChannelColumnWidth(activeProduct.id, resizeWidthRef.current);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-8 py-4">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setActiveCategory('newChannels')}
              className={cn(
                'rounded-lg px-6 py-2 text-sm font-semibold transition-all duration-200',
                activeCategory === 'newChannels'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              New Customer
            </button>
            <button
              onClick={() => setActiveCategory('existingChannels')}
              className={cn(
                'rounded-lg px-6 py-2 text-sm font-semibold transition-all duration-200',
                activeCategory === 'existingChannels'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              Existing Customer
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => addChannel(activeProduct.id, 'New Channel')}
              className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-slate-800"
            >
              <Plus size={16} />
              Add Channel
            </button>
            <button
              onClick={() => addFunnel(activeProduct.id, 'New Funnel')}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700"
            >
              <Plus size={16} />
              Add Funnel
            </button>
          </div>
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
                        Drag to reorder rows
                      </span>
                    </div>
                    <div
                      onMouseDown={handleResizeStart}
                      className="absolute inset-y-0 right-0 w-3 cursor-col-resize bg-transparent"
                    />
                  </div>
                </th>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFunnelDragEnd}>
                  <SortableContext items={funnelIds} strategy={horizontalListSortingStrategy}>
                    {funnels.map((funnel) => (
                      <SortableFunnelHeader
                        key={funnel.id}
                        productId={activeProduct.id}
                        funnel={funnel}
                        activeCategory={activeCategory}
                        allFunnels={funnels}
                        onUpdateName={(funnelId, name) => updateFunnelName(activeProduct.id, funnelId, name)}
                        onUpdateTarget={(funnelId, value) =>
                          updateFunnelTarget(activeProduct.id, activeCategory, funnelId, value)
                        }
                        onUpdateParent={(funnelId, parentFunnelId) =>
                          updateFunnelParent(activeProduct.id, funnelId, parentFunnelId)
                        }
                        onDeleteRequest={(funnelId, name) =>
                          setPendingDelete({ type: 'funnel', id: funnelId, name })
                        }
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

                {funnels.map((funnel) => {
                  const totals = getFunnelTotals(funnel.id);
                  const currentTarget = funnel.targets[activeCategory];
                  const diff = getTargetDiff(totals.visits, currentTarget);
                  const isNegative = diff < 0;
                  const conversion = getConversionRate(funnel.id);

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
                            <div className="mt-1 text-lg font-bold text-emerald-400">
                              ฿{formatNumber(totals.revenue)}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                            {getConversionLabel(funnel.id)}
                          </div>
                          <div
                            className={cn(
                              'mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold',
                              conversion === null
                                ? 'bg-slate-700 text-slate-300'
                                : 'bg-blue-500/15 text-blue-300',
                            )}
                          >
                            {conversion === null ? '-' : formatPercent(conversion)}
                          </div>
                        </div>

                        <div
                          className={cn(
                            'flex items-center justify-between rounded-xl border p-2',
                            isNegative ? 'border-red-500/20 bg-red-500/10' : 'border-blue-500/20 bg-blue-500/10',
                          )}
                        >
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              Vs Target
                            </div>
                            <div className={cn('text-sm font-bold', isNegative ? 'text-red-400' : 'text-blue-400')}>
                              {diff > 0 ? '+' : ''}{formatPercent(diff)}
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
                  {channels.map((channel) => (
                    <SortableChannelRow
                      key={channel.id}
                      productId={activeProduct.id}
                      channel={channel}
                      funnels={funnels}
                      activeCategory={activeCategory}
                      channelColumnWidth={channelColumnWidth}
                      getCellData={getCellData}
                      getChannelConversionMeta={getConversionMeta}
                      onUpdateName={(channelId, name) => updateChannelName(activeProduct.id, channelId, name)}
                      onDeleteRequest={(channelId, name) =>
                        setPendingDelete({ type: 'channel', id: channelId, name })
                      }
                      onUpdateCellData={(funnelId, channelId, field, value) =>
                        updateCellData(activeProduct.id, activeCategory, funnelId, channelId, field, value)
                      }
                    />
                  ))}
                </tbody>
              </SortableContext>
            </DndContext>
          </table>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={pendingDelete !== null}
        title={pendingDelete?.type === 'funnel' ? 'Delete funnel?' : 'Delete channel?'}
        message={
          pendingDelete
            ? `Delete "${pendingDelete.name}"? This change will update the saved product data immediately.`
            : ''
        }
        confirmLabel={pendingDelete?.type === 'funnel' ? 'Delete Funnel' : 'Delete Channel'}
        tone="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) {
            return;
          }

          if (pendingDelete.type === 'funnel') {
            removeFunnel(activeProduct.id, pendingDelete.id);
          } else {
            removeChannel(activeProduct.id, pendingDelete.id);
          }

          setPendingDelete(null);
        }}
      />
    </>
  );
};
