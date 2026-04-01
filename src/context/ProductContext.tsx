import React, { createContext, useContext, useState, useCallback } from 'react';
import { Product, CategoryType, FunnelStage, Channel } from '../types';
import { MOCK_PRODUCTS } from '../data/mockData';

interface GlobalTargets {
  revenue: number;
  newCustomers: number;
  existingCustomers: number;
}

interface ProductContextType {
  products: Product[];
  activeProduct: Product | null;
  globalTargets: GlobalTargets;
  updateGlobalTargets: (targets: Partial<GlobalTargets>) => void;
  setActiveProductById: (id: string | null) => void;
  addProduct: (name: string) => void;
  updateProductName: (id: string, name: string) => void;
  deleteProduct: (id: string) => void;
  updateCellData: (
    productId: string,
    category: CategoryType,
    funnelId: string,
    channelId: string,
    field: 'visits' | 'revenue',
    value: number
  ) => void;
  updateFunnelTarget: (productId: string, funnelId: string, value: number) => void;
  addFunnel: (productId: string, name: string) => void;
  removeFunnel: (productId: string, funnelId: string) => void;
  updateFunnelName: (productId: string, funnelId: string, name: string) => void;
  addChannel: (productId: string, name: string) => void;
  removeChannel: (productId: string, channelId: string) => void;
  updateChannelName: (productId: string, channelId: string, name: string) => void;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [globalTargets, setGlobalTargets] = useState<GlobalTargets>({
    revenue: 1000000,
    newCustomers: 50000,
    existingCustomers: 100000,
  });

  const activeProduct = products.find((p) => p.id === activeProductId) || null;

  const setActiveProductById = useCallback((id: string | null) => {
    setActiveProductId(id);
  }, []);

  const updateGlobalTargets = useCallback((targets: Partial<GlobalTargets>) => {
    setGlobalTargets((prev) => ({ ...prev, ...targets }));
  }, []);

  const addProduct = useCallback((name: string) => {
    const newProduct: Product = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      funnels: [{ id: 'f1', name: 'Funnel 1', target: 0 }],
      channels: [{ id: 'c1', name: 'Channel 1' }],
      data: {
        newChannels: { f1: { c1: { visits: 0, revenue: 0 } } },
        existingChannels: { f1: { c1: { visits: 0, revenue: 0 } } },
      },
    };
    setProducts((prev) => [...prev, newProduct]);
    setActiveProductId(newProduct.id);
  }, []);

  const updateProductName = useCallback((id: string, name: string) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      if (activeProductId === id && filtered.length > 0) {
        setActiveProductId(filtered[0].id);
      }
      return filtered;
    });
  }, [activeProductId]);

  const updateCellData = useCallback(
    (productId: string, category: CategoryType, funnelId: string, channelId: string, field: 'visits' | 'revenue', value: number) => {
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== productId) return p;
          const newData = { ...p.data };
          const categoryData = { ...newData[category] };
          const funnelData = categoryData[funnelId] ? { ...categoryData[funnelId] } : {};
          const channelData = funnelData[channelId] ? { ...funnelData[channelId] } : { visits: 0, revenue: 0 };
          
          channelData[field] = value;
          funnelData[channelId] = channelData;
          categoryData[funnelId] = funnelData;
          newData[category] = categoryData;

          return { ...p, data: newData };
        })
      );
    },
    []
  );

  const updateFunnelTarget = useCallback((productId: string, funnelId: string, value: number) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        return {
          ...p,
          funnels: p.funnels.map((f) => (f.id === funnelId ? { ...f, target: value } : f)),
        };
      })
    );
  }, []);

  const addFunnel = useCallback((productId: string, name: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        if (p.funnels.length >= 10) return p;
        const id = 'f' + (p.funnels.length + 1) + Math.random().toString(36).substr(2, 4);
        const newFunnel: FunnelStage = { id, name, target: 0 };
        
        const newData = { ...p.data };
        p.channels.forEach(c => {
          if (!newData.newChannels[id]) newData.newChannels[id] = {};
          if (!newData.existingChannels[id]) newData.existingChannels[id] = {};
          newData.newChannels[id][c.id] = { visits: 0, revenue: 0 };
          newData.existingChannels[id][c.id] = { visits: 0, revenue: 0 };
        });

        return { ...p, funnels: [...p.funnels, newFunnel], data: newData };
      })
    );
  }, []);

  const removeFunnel = useCallback((productId: string, funnelId: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        if (p.funnels.length <= 1) return p;
        const newData = { ...p.data };
        delete newData.newChannels[funnelId];
        delete newData.existingChannels[funnelId];
        return {
          ...p,
          funnels: p.funnels.filter((f) => f.id !== funnelId),
          data: newData,
        };
      })
    );
  }, []);

  const updateFunnelName = useCallback((productId: string, funnelId: string, name: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        return {
          ...p,
          funnels: p.funnels.map((f) => (f.id === funnelId ? { ...f, name } : f)),
        };
      })
    );
  }, []);

  const addChannel = useCallback((productId: string, name: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        if (p.channels.length >= 10) return p;
        const id = 'c' + (p.channels.length + 1) + Math.random().toString(36).substr(2, 4);
        const newChannel: Channel = { id, name };
        
        const newData = { ...p.data };
        p.funnels.forEach(f => {
          if (!newData.newChannels[f.id]) newData.newChannels[f.id] = {};
          if (!newData.existingChannels[f.id]) newData.existingChannels[f.id] = {};
          newData.newChannels[f.id][id] = { visits: 0, revenue: 0 };
          newData.existingChannels[f.id][id] = { visits: 0, revenue: 0 };
        });

        return { ...p, channels: [...p.channels, newChannel], data: newData };
      })
    );
  }, []);

  const removeChannel = useCallback((productId: string, channelId: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        if (p.channels.length <= 1) return p;
        const newData = { ...p.data };
        p.funnels.forEach(f => {
          delete newData.newChannels[f.id][channelId];
          delete newData.existingChannels[f.id][channelId];
        });
        return {
          ...p,
          channels: p.channels.filter((c) => c.id !== channelId),
          data: newData,
        };
      })
    );
  }, []);

  const updateChannelName = useCallback((productId: string, channelId: string, name: string) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        return {
          ...p,
          channels: p.channels.map((c) => (c.id === channelId ? { ...c, name } : c)),
        };
      })
    );
  }, []);

  return (
    <ProductContext.Provider
      value={{
        products,
        activeProduct,
        globalTargets,
        updateGlobalTargets,
        setActiveProductById,
        addProduct,
        updateProductName,
        deleteProduct,
        updateCellData,
        updateFunnelTarget,
        addFunnel,
        removeFunnel,
        updateFunnelName,
        addChannel,
        removeChannel,
        updateChannelName,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error('useProducts must be used within a ProductProvider');
  }
  return context;
};
