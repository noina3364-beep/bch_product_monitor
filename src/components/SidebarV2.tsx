import React, { useMemo, useState } from 'react';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Copy,
  Edit2,
  GripVertical,
  LayoutDashboard,
  Package,
  Plus,
  Trash2,
} from 'lucide-react';
import { useProducts } from '../context/ProductContextV2';
import { cn } from '../lib/utils';
import { ConfirmationDialog } from './ConfirmationDialog';

interface SortableProductRowProps {
  product: {
    id: string;
    name: string;
  };
  isActive: boolean;
  isEditing: boolean;
  editName: string;
  onSelect: () => void;
  onStartEdit: (event: React.MouseEvent, id: string, name: string) => void;
  onSaveEdit: (id: string) => void;
  onEditNameChange: (value: string) => void;
  onDuplicate: (event: React.MouseEvent, id: string) => void;
  onDelete: (event: React.MouseEvent, id: string, name: string) => void;
}

const SortableProductRow: React.FC<SortableProductRowProps> = ({
  product,
  isActive,
  isEditing,
  editName,
  onSelect,
  onStartEdit,
  onSaveEdit,
  onEditNameChange,
  onDuplicate,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      onClick={onSelect}
      className={cn(
        'group flex items-start justify-between gap-2 rounded-md px-3 py-2 transition-all duration-200',
        isActive
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
          : 'cursor-pointer text-slate-400 hover:bg-slate-800 hover:text-slate-200',
        isDragging && 'opacity-70 ring-2 ring-blue-300',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <button
          type="button"
          className={cn(
            'mt-0.5 rounded p-1 transition-colors',
            isActive ? 'text-blue-200 hover:bg-blue-500/30' : 'text-slate-500 hover:bg-slate-700',
          )}
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={13} />
        </button>
        <Package size={16} className={cn('mt-1 shrink-0', isActive ? 'text-blue-200' : 'text-slate-500')} />
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              autoFocus
              className="w-full rounded border border-blue-400 bg-slate-800 px-1 py-0.5 text-sm text-white outline-none"
              value={editName}
              onChange={(event) => onEditNameChange(event.target.value)}
              onBlur={() => onSaveEdit(product.id)}
              onKeyDown={(event) => event.key === 'Enter' && onSaveEdit(product.id)}
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <span
              className="block text-sm font-medium leading-snug break-words"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {product.name}
            </span>
          )}
        </div>
      </div>

      <div
        className={cn(
          'flex items-center gap-1 opacity-0 transition-opacity',
          isActive && 'opacity-100',
          'group-hover:opacity-100',
        )}
      >
        <button
          onClick={(event) => onDuplicate(event, product.id)}
          className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
        >
          <Copy size={12} />
        </button>
        <button
          onClick={(event) => onStartEdit(event, product.id, product.name)}
          className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
        >
          <Edit2 size={12} />
        </button>
        <button
          onClick={(event) => onDelete(event, product.id, product.name)}
          className="rounded p-1 text-slate-400 hover:bg-red-900 hover:text-red-300"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const {
    products,
    activeProduct,
    setActiveProductById,
    addProduct,
    duplicateProduct,
    reorderProducts,
    deleteProduct,
    updateProductName,
  } = useProducts();
  const [isAdding, setIsAdding] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const productIds = useMemo(() => products.map((product) => product.id), [products]);

  const handleAdd = () => {
    if (newProductName.trim()) {
      addProduct(newProductName.trim());
      setNewProductName('');
      setIsAdding(false);
    }
  };

  const handleStartEdit = (event: React.MouseEvent, id: string, name: string) => {
    event.stopPropagation();
    setEditingId(id);
    setEditName(name);
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      updateProductName(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = productIds.indexOf(String(active.id));
    const newIndex = productIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    reorderProducts(arrayMove(productIds, oldIndex, newIndex));
  };

  return (
    <>
      <div className="flex h-screen w-72 flex-col border-r border-slate-800 bg-slate-900 text-white">
        <div className="flex items-center gap-3 border-b border-slate-800 p-5">
          <img
            src="/images/B.png"
            alt="Bangkok Hospital Chanthaburi"
            className="h-12 w-12 shrink-0 object-contain"
          />
          <h1 className="text-lg font-bold tracking-tight text-white">BCH Product Monitor</h1>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 px-3 py-4">
          <div
            onClick={() => setActiveProductById(null)}
            className={cn(
              'group mb-4 flex items-center gap-3 rounded-md px-3 py-2 transition-all duration-200',
              activeProduct === null
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                : 'cursor-pointer text-slate-400 hover:bg-slate-800 hover:text-slate-200',
            )}
          >
            <LayoutDashboard size={18} className={activeProduct === null ? 'text-blue-200' : 'text-slate-500'} />
            <span className="text-sm font-bold tracking-wide">Main Dashboard</span>
          </div>

          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Products
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={productIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {products.map((product) => (
                  <SortableProductRow
                    key={product.id}
                    product={product}
                    isActive={activeProduct?.id === product.id}
                    isEditing={editingId === product.id}
                    editName={editName}
                    onSelect={() => setActiveProductById(product.id)}
                    onStartEdit={handleStartEdit}
                    onSaveEdit={handleSaveEdit}
                    onEditNameChange={setEditName}
                    onDuplicate={(event, id) => {
                      event.stopPropagation();
                      duplicateProduct(id);
                    }}
                    onDelete={(event, id, name) => {
                      event.stopPropagation();
                      setPendingDelete({ id, name });
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {isAdding ? (
            <div className="px-3 py-2">
              <input
                autoFocus
                placeholder="Product name..."
                className="w-full rounded-md border border-blue-500 bg-slate-800 px-3 py-2 text-sm text-white outline-none"
                value={newProductName}
                onChange={(event) => setNewProductName(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleAdd()}
                onBlur={() => !newProductName && setIsAdding(false)}
              />
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-500 transition-all hover:bg-slate-800 hover:text-blue-400"
            >
              <Plus size={16} />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      <ConfirmationDialog
        isOpen={pendingDelete !== null}
        title="Delete product?"
        message={
          pendingDelete
            ? `Delete "${pendingDelete.name}" and all of its funnels, channels, targets, and values? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Product"
        tone="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deleteProduct(pendingDelete.id);
          }
          setPendingDelete(null);
        }}
      />
    </>
  );
};
