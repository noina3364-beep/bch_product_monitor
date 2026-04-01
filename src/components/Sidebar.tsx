import React, { useState } from 'react';
import { useProducts } from '../context/ProductContext';
import { Plus, Trash2, Edit2, LayoutDashboard, ChevronRight, Package } from 'lucide-react';
import { cn } from '../lib/utils';

export const Sidebar: React.FC = () => {
  const { products, activeProduct, setActiveProductById, addProduct, deleteProduct, updateProductName } = useProducts();
  const [isAdding, setIsAdding] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = () => {
    if (newProductName.trim()) {
      addProduct(newProductName.trim());
      setNewProductName('');
      setIsAdding(false);
    }
  };

  const handleStartEdit = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setEditingId(id);
    setEditName(name);
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      updateProductName(id, editName.trim());
      setEditingId(null);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this product?')) {
      deleteProduct(id);
    }
  };

  return (
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col border-r border-slate-800">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="bg-blue-600 p-2 rounded-lg">
          <LayoutDashboard size={20} />
        </div>
        <h1 className="font-bold text-lg tracking-tight">BCH Product Monitor</h1>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <div
          onClick={() => setActiveProductById(null)}
          className={cn(
            "group flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-all duration-200 mb-4",
            activeProduct === null 
              ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          )}
        >
          <LayoutDashboard size={18} className={activeProduct === null ? "text-blue-200" : "text-slate-500"} />
          <span className="text-sm font-bold tracking-wide">Main Dashboard</span>
        </div>

        <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Products
        </div>
        
        {products.map((product) => (
          <div
            key={product.id}
            onClick={() => setActiveProductById(product.id)}
            className={cn(
              "group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-all duration-200",
              activeProduct?.id === product.id 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Package size={16} className={activeProduct?.id === product.id ? "text-blue-200" : "text-slate-500"} />
              {editingId === product.id ? (
                <input
                  autoFocus
                  className="bg-slate-800 text-white text-sm px-1 py-0.5 rounded w-full outline-none border border-blue-400"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleSaveEdit(product.id)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(product.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm font-medium truncate">{product.name}</span>
              )}
            </div>
            
            <div className={cn(
              "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
              activeProduct?.id === product.id && "opacity-100"
            )}>
              <button 
                onClick={(e) => handleStartEdit(e, product.id, product.name)}
                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
              >
                <Edit2 size={12} />
              </button>
              <button 
                onClick={(e) => handleDelete(e, product.id)}
                className="p-1 hover:bg-red-900 rounded text-slate-400 hover:text-red-400"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}

        {isAdding ? (
          <div className="px-3 py-2">
            <input
              autoFocus
              placeholder="Product name..."
              className="w-full bg-slate-800 text-white text-sm px-3 py-2 rounded-md outline-none border border-blue-500"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              onBlur={() => !newProductName && setIsAdding(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded-md transition-all"
          >
            <Plus size={16} />
            <span>Add Product</span>
          </button>
        )}
      </div>
    </div>
  );
};
