import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  BackupPayload,
  GlobalTargets,
  PeriodSelection,
  Product,
  ProductCategoryKey,
} from '../types';
import { apiRequest } from '../lib/api';
import { getCurrentPeriodSelection } from '../lib/periods';

interface ProductContextType {
  products: Product[];
  activeProduct: Product | null;
  globalTargets: GlobalTargets;
  period: PeriodSelection;
  isLoading: boolean;
  error: string | null;
  dismissError: () => void;
  setPeriod: (period: PeriodSelection) => void;
  updateGlobalTargets: (targets: Partial<GlobalTargets>) => Promise<void>;
  setActiveProductById: (id: string | null) => void;
  addProduct: (name: string) => Promise<void>;
  duplicateProduct: (id: string) => Promise<void>;
  reorderProducts: (productIds: string[]) => Promise<void>;
  updateProductName: (id: string, name: string) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  updateCellData: (
    productId: string,
    category: ProductCategoryKey,
    weekStartDate: string,
    funnelId: string,
    channelId: string,
    field: 'visits' | 'revenue',
    value: number,
  ) => Promise<void>;
  updateFunnelTarget: (
    productId: string,
    category: ProductCategoryKey,
    funnelId: string,
    value: number,
  ) => Promise<void>;
  updateFunnelParent: (
    productId: string,
    category: ProductCategoryKey,
    funnelId: string,
    parentFunnelId: string | null,
  ) => Promise<void>;
  reorderFunnels: (productId: string, category: ProductCategoryKey, funnelIds: string[]) => Promise<void>;
  addFunnel: (productId: string, category: ProductCategoryKey, name: string) => Promise<void>;
  removeFunnel: (productId: string, category: ProductCategoryKey, funnelId: string) => Promise<void>;
  updateFunnelName: (productId: string, category: ProductCategoryKey, funnelId: string, name: string) => Promise<void>;
  reorderChannels: (productId: string, category: ProductCategoryKey, channelIds: string[]) => Promise<void>;
  addChannel: (productId: string, category: ProductCategoryKey, name: string) => Promise<void>;
  removeChannel: (productId: string, category: ProductCategoryKey, channelId: string) => Promise<void>;
  updateChannelName: (productId: string, category: ProductCategoryKey, channelId: string, name: string) => Promise<void>;
  updateChannelColumnWidth: (productId: string, category: ProductCategoryKey, width: number) => Promise<void>;
  exportBackup: () => Promise<BackupPayload>;
  importBackup: (payload: BackupPayload) => Promise<void>;
  reloadProducts: () => Promise<void>;
}

interface ProductResponse {
  product: Product;
}

interface ProductSummary {
  id: string;
  name: string;
  position: number;
}

interface ProductsResponse {
  products: ProductSummary[];
}

interface DashboardTargetsResponse {
  globalTargets: GlobalTargets;
}

interface BackupImportResponse {
  products: Product[];
  globalTargets: GlobalTargets;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

function sortCategory<T extends { position: number }>(items: T[]) {
  return [...items].sort((a, b) => a.position - b.position);
}

function sortProduct(product: Product): Product {
  return {
    ...product,
    categories: {
      new: {
        ...product.categories.new,
        funnels: sortCategory(product.categories.new.funnels),
        channels: sortCategory(product.categories.new.channels),
      },
      existing: {
        ...product.categories.existing,
        funnels: sortCategory(product.categories.existing.funnels),
        channels: sortCategory(product.categories.existing.channels),
      },
    },
  };
}

function sortProducts(products: Product[]) {
  return [...products].map(sortProduct).sort((a, b) => a.position - b.position);
}

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [globalTargets, setGlobalTargets] = useState<GlobalTargets>({
    revenue: 250000,
    newCustomers: 12500,
    existingCustomers: 18000,
  });
  const [period, setPeriod] = useState<PeriodSelection>(getCurrentPeriodSelection());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeProduct = products.find((p) => p.id === activeProductId) ?? null;

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((nextError: unknown) => {
    console.error(nextError);
    setError(nextError instanceof Error ? nextError.message : 'Something went wrong');
  }, []);

  const replaceProduct = useCallback((nextProduct: Product) => {
    setProducts((prev) => {
      const normalized = sortProduct(nextProduct);
      const existingIndex = prev.findIndex((product) => product.id === normalized.id);

      if (existingIndex === -1) {
        return sortProducts([...prev, normalized]);
      }

      const nextProducts = [...prev];
      nextProducts[existingIndex] = normalized;
      return sortProducts(nextProducts);
    });
  }, []);

  const fetchProduct = useCallback(async (productId: string) => {
    const response = await apiRequest<ProductResponse>(`/products/${productId}/dashboard`);
    return sortProduct(response.product);
  }, []);

  const reloadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [targetsResponse, productsResponse] = await Promise.all([
        apiRequest<DashboardTargetsResponse>('/targets/dashboard'),
        apiRequest<ProductsResponse>('/products'),
      ]);

      const nextProducts = await Promise.all(
        productsResponse.products
          .sort((a, b) => a.position - b.position)
          .map(async (product) => fetchProduct(product.id)),
      );

      setProducts(sortProducts(nextProducts));
      setGlobalTargets(targetsResponse.globalTargets);
      setActiveProductId((current) =>
        current && nextProducts.some((product) => product.id === current) ? current : null,
      );
    } catch (nextError) {
      handleError(nextError);
    } finally {
      setIsLoading(false);
    }
  }, [fetchProduct, handleError]);

  useEffect(() => {
    void reloadProducts();
  }, [reloadProducts]);

  const runProductMutation = useCallback(
    async (request: Promise<ProductResponse>) => {
      setError(null);
      const response = await request;
      replaceProduct(response.product);
      return response.product;
    },
    [replaceProduct],
  );

  const setActiveProductById = useCallback((id: string | null) => {
    setActiveProductId(id);
  }, []);

  const updateGlobalTargets = useCallback(
    async (targets: Partial<GlobalTargets>) => {
      setError(null);

      try {
        const response = await apiRequest<DashboardTargetsResponse>('/targets/dashboard', {
          method: 'PATCH',
          body: JSON.stringify(targets),
        });
        setGlobalTargets(response.globalTargets);
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError],
  );

  const addProduct = useCallback(
    async (name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return;
      }

      try {
        const product = await runProductMutation(
          apiRequest<ProductResponse>('/products', {
            method: 'POST',
            body: JSON.stringify({ name: trimmedName }),
          }),
        );
        setActiveProductId(product.id);
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError, runProductMutation],
  );

  const duplicateProduct = useCallback(
    async (id: string) => {
      try {
        const product = await runProductMutation(
          apiRequest<ProductResponse>(`/products/${id}/duplicate`, {
            method: 'POST',
          }),
        );
        await reloadProducts();
        setActiveProductId(product.id);
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError, reloadProducts, runProductMutation],
  );

  const reorderProducts = useCallback(
    async (productIds: string[]) => {
      setError(null);

      try {
        await apiRequest<ProductsResponse>('/products/reorder', {
          method: 'PATCH',
          body: JSON.stringify({ productIds }),
        });
        await reloadProducts();
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError, reloadProducts],
  );

  const updateProductName = useCallback(
    async (id: string, name: string) => {
      try {
        await runProductMutation(
          apiRequest<ProductResponse>(`/products/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ name }),
          }),
        );
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError, runProductMutation],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      setError(null);

      try {
        await apiRequest<void>(`/products/${id}`, {
          method: 'DELETE',
        });
        setProducts((prev) => sortProducts(prev.filter((product) => product.id !== id)));
        setActiveProductId((current) => (current === id ? null : current));
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError],
  );

  const updateCellData = useCallback(
    async (
      productId: string,
      category: ProductCategoryKey,
      weekStartDate: string,
      funnelId: string,
      channelId: string,
      field: 'visits' | 'revenue',
      value: number,
    ) => {
      try {
        await runProductMutation(
          apiRequest<ProductResponse>(
            `/products/${productId}/categories/${category}/input-values/${weekStartDate}/${funnelId}/${channelId}`,
            {
              method: 'PATCH',
              body: JSON.stringify({ [field]: value }),
            },
          ),
        );
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError, runProductMutation],
  );

  const updateFunnelTarget = useCallback(
    async (productId: string, category: ProductCategoryKey, funnelId: string, value: number) => {
      try {
        await runProductMutation(
          apiRequest<ProductResponse>(`/products/${productId}/categories/${category}/funnels/${funnelId}`, {
            method: 'PATCH',
            body: JSON.stringify({ targetVisits: value }),
          }),
        );
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError, runProductMutation],
  );

  const updateFunnelParent = useCallback(
    async (
      productId: string,
      category: ProductCategoryKey,
      funnelId: string,
      parentFunnelId: string | null,
    ) => {
      try {
        await runProductMutation(
          apiRequest<ProductResponse>(`/products/${productId}/categories/${category}/funnels/${funnelId}`, {
            method: 'PATCH',
            body: JSON.stringify({ parentFunnelId }),
          }),
        );
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError, runProductMutation],
  );

  const reorderFunnels = useCallback(
    async (productId: string, category: ProductCategoryKey, funnelIds: string[]) => {
      try {
        await runProductMutation(
          apiRequest<ProductResponse>(`/products/${productId}/categories/${category}/funnels/reorder`, {
            method: 'PATCH',
            body: JSON.stringify({ funnelIds }),
          }),
        );
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError, runProductMutation],
  );

  const addFunnel = useCallback(
    async (productId: string, category: ProductCategoryKey, name: string) => {
      try {
        await runProductMutation(
          apiRequest<ProductResponse>(`/products/${productId}/categories/${category}/funnels`, {
            method: 'POST',
            body: JSON.stringify({ name }),
          }),
        );
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError, runProductMutation],
  );

  const removeFunnel = useCallback(
    async (productId: string, category: ProductCategoryKey, funnelId: string) => {
      try {
        await runProductMutation(
          apiRequest<ProductResponse>(`/products/${productId}/categories/${category}/funnels/${funnelId}`, {
            method: 'DELETE',
          }),
        );
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError, runProductMutation],
  );

  const updateFunnelName = useCallback(
    async (productId: string, category: ProductCategoryKey, funnelId: string, name: string) => {
      try {
        await runProductMutation(
          apiRequest<ProductResponse>(`/products/${productId}/categories/${category}/funnels/${funnelId}`, {
            method: 'PATCH',
            body: JSON.stringify({ name }),
          }),
        );
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError, runProductMutation],
  );

  const reorderChannels = useCallback(
    async (productId: string, category: ProductCategoryKey, channelIds: string[]) => {
      try {
        await runProductMutation(
          apiRequest<ProductResponse>(`/products/${productId}/categories/${category}/channels/reorder`, {
            method: 'PATCH',
            body: JSON.stringify({ channelIds }),
          }),
        );
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError, runProductMutation],
  );

  const addChannel = useCallback(
    async (productId: string, category: ProductCategoryKey, name: string) => {
      try {
        await runProductMutation(
          apiRequest<ProductResponse>(`/products/${productId}/categories/${category}/channels`, {
            method: 'POST',
            body: JSON.stringify({ name }),
          }),
        );
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError, runProductMutation],
  );

  const removeChannel = useCallback(
    async (productId: string, category: ProductCategoryKey, channelId: string) => {
      try {
        await runProductMutation(
          apiRequest<ProductResponse>(`/products/${productId}/categories/${category}/channels/${channelId}`, {
            method: 'DELETE',
          }),
        );
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError, runProductMutation],
  );

  const updateChannelName = useCallback(
    async (productId: string, category: ProductCategoryKey, channelId: string, name: string) => {
      try {
        await runProductMutation(
          apiRequest<ProductResponse>(`/products/${productId}/categories/${category}/channels/${channelId}`, {
            method: 'PATCH',
            body: JSON.stringify({ name }),
          }),
        );
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError, runProductMutation],
  );

  const updateChannelColumnWidth = useCallback(
    async (productId: string, category: ProductCategoryKey, width: number) => {
      try {
        await runProductMutation(
          apiRequest<ProductResponse>(`/products/${productId}/categories/${category}/layout`, {
            method: 'PATCH',
            body: JSON.stringify({ channelColumnWidth: width }),
          }),
        );
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError, runProductMutation],
  );

  const exportBackup = useCallback(async () => {
    return apiRequest<BackupPayload>('/backup/export');
  }, []);

  const importBackup = useCallback(
    async (payload: BackupPayload) => {
      setError(null);

      try {
        const response = await apiRequest<BackupImportResponse>('/backup/import', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        const sortedProducts = sortProducts(response.products);
        setProducts(sortedProducts);
        setGlobalTargets(response.globalTargets);
        setActiveProductId(sortedProducts[0]?.id ?? null);
      } catch (nextError) {
        handleError(nextError);
        throw nextError;
      }
    },
    [handleError],
  );

  const value = useMemo<ProductContextType>(
    () => ({
      products,
      activeProduct,
      globalTargets,
      period,
      isLoading,
      error,
      dismissError,
      setPeriod,
      updateGlobalTargets,
      setActiveProductById,
      addProduct,
      duplicateProduct,
      reorderProducts,
      updateProductName,
      deleteProduct,
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
      exportBackup,
      importBackup,
      reloadProducts,
    }),
    [
      activeProduct,
      addChannel,
      addFunnel,
      addProduct,
      deleteProduct,
      dismissError,
      duplicateProduct,
      error,
      exportBackup,
      globalTargets,
      importBackup,
      isLoading,
      period,
      reloadProducts,
      removeChannel,
      removeFunnel,
      reorderChannels,
      reorderFunnels,
      reorderProducts,
      setActiveProductById,
      setPeriod,
      updateCellData,
      updateChannelColumnWidth,
      updateChannelName,
      updateFunnelName,
      updateFunnelParent,
      updateFunnelTarget,
      updateGlobalTargets,
      updateProductName,
      products,
    ],
  );

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
};

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error('useProducts must be used within a ProductProvider');
  }

  return context;
};
