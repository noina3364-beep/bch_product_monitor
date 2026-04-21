import React, { useMemo, useState } from 'react';
import { LayoutGrid, TableProperties } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../context/ProductContextV2';
import type { ProductCategoryKey } from '../types';
import { cn } from '../lib/utils';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ProductBoard } from './ProductBoard';
import { ProductTable } from './ProductTable';
import { toWeekStartKey } from '../lib/periods';

type ProductViewMode = 'board' | 'table';

export const MonitoringTableAuth: React.FC = () => {
  const { isEditor } = useAuth();
  const {
    activeProduct,
    period,
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
  const [activeCategory, setActiveCategory] = useState<ProductCategoryKey>('new');
  const [viewMode, setViewMode] = useState<ProductViewMode>('board');
  const [pendingDelete, setPendingDelete] = useState<
    { type: 'funnel' | 'channel'; id: string; name: string } | null
  >(null);

  const categoryState = useMemo(() => {
    if (!activeProduct) {
      return null;
    }

    return activeProduct.categories[activeCategory];
  }, [activeCategory, activeProduct]);

  if (!activeProduct || !categoryState) {
    return null;
  }

  const weekStartDate = toWeekStartKey(period.referenceDate);
  const canEditStructure = isEditor;
  const canEditValues = isEditor && period.view === 'week';

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden bg-white">
        <div className="border-b border-slate-200 bg-white px-8 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1">
              {(['new', 'existing'] as const).map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={cn(
                    'rounded-lg px-5 py-2 text-sm font-semibold transition-colors',
                    activeCategory === category
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  {category === 'new' ? 'New Customer' : 'Existing Customer'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                  viewMode === 'board'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                )}
              >
                <LayoutGrid size={15} />
                Board
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                  viewMode === 'table'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                )}
              >
                <TableProperties size={15} />
                Table
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {viewMode === 'board' ? (
            <ProductBoard
              productId={activeProduct.id}
              categoryKey={activeCategory}
              categoryState={categoryState}
              period={period}
              canEditStructure={canEditStructure}
              canEditValues={canEditValues}
              onUpdateCellData={(funnelId, channelId, field, value) =>
                void updateCellData(activeProduct.id, activeCategory, weekStartDate, funnelId, channelId, field, value)
              }
              onUpdateFunnelTarget={(funnelId, value) =>
                void updateFunnelTarget(activeProduct.id, activeCategory, funnelId, value)
              }
              onUpdateFunnelParent={(funnelId, parentFunnelId) =>
                void updateFunnelParent(activeProduct.id, activeCategory, funnelId, parentFunnelId)
              }
              onReorderFunnels={(funnelIds) => reorderFunnels(activeProduct.id, activeCategory, funnelIds)}
              onAddFunnel={() => void addFunnel(activeProduct.id, activeCategory, 'New Funnel')}
              onRemoveFunnel={(funnelId, name) => setPendingDelete({ type: 'funnel', id: funnelId, name })}
              onUpdateFunnelName={(funnelId, name) =>
                void updateFunnelName(activeProduct.id, activeCategory, funnelId, name)
              }
              onReorderChannels={(channelIds) => reorderChannels(activeProduct.id, activeCategory, channelIds)}
              onAddChannel={() => void addChannel(activeProduct.id, activeCategory, 'New Channel')}
              onRemoveChannel={(channelId, name) => setPendingDelete({ type: 'channel', id: channelId, name })}
              onUpdateChannelName={(channelId, name) =>
                void updateChannelName(activeProduct.id, activeCategory, channelId, name)
              }
            />
          ) : (
            <ProductTable
              productId={activeProduct.id}
              categoryKey={activeCategory}
              categoryState={categoryState}
              period={period}
              canEditStructure={canEditStructure}
              canEditValues={canEditValues}
              onUpdateCellData={(funnelId, channelId, field, value) =>
                void updateCellData(activeProduct.id, activeCategory, weekStartDate, funnelId, channelId, field, value)
              }
              onUpdateFunnelTarget={(funnelId, value) =>
                void updateFunnelTarget(activeProduct.id, activeCategory, funnelId, value)
              }
              onUpdateFunnelParent={(funnelId, parentFunnelId) =>
                void updateFunnelParent(activeProduct.id, activeCategory, funnelId, parentFunnelId)
              }
              onReorderFunnels={(funnelIds) => reorderFunnels(activeProduct.id, activeCategory, funnelIds)}
              onAddFunnel={() => void addFunnel(activeProduct.id, activeCategory, 'New Funnel')}
              onRemoveFunnel={(funnelId, name) => setPendingDelete({ type: 'funnel', id: funnelId, name })}
              onUpdateFunnelName={(funnelId, name) =>
                void updateFunnelName(activeProduct.id, activeCategory, funnelId, name)
              }
              onReorderChannels={(channelIds) => reorderChannels(activeProduct.id, activeCategory, channelIds)}
              onAddChannel={() => void addChannel(activeProduct.id, activeCategory, 'New Channel')}
              onRemoveChannel={(channelId, name) => setPendingDelete({ type: 'channel', id: channelId, name })}
              onUpdateChannelName={(channelId, name) =>
                void updateChannelName(activeProduct.id, activeCategory, channelId, name)
              }
              onUpdateChannelColumnWidth={(width) =>
                void updateChannelColumnWidth(activeProduct.id, activeCategory, width)
              }
            />
          )}
        </div>
      </div>

      <ConfirmationDialog
        isOpen={isEditor && pendingDelete !== null}
        title={pendingDelete?.type === 'funnel' ? 'Delete funnel?' : 'Delete channel?'}
        message={
          pendingDelete
            ? `Delete "${pendingDelete.name}" from the ${activeCategory === 'new' ? 'New' : 'Existing'} category? Historical weekly values for that item will be removed too.`
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
            void removeFunnel(activeProduct.id, activeCategory, pendingDelete.id);
          } else {
            void removeChannel(activeProduct.id, activeCategory, pendingDelete.id);
          }

          setPendingDelete(null);
        }}
      />
    </>
  );
};
