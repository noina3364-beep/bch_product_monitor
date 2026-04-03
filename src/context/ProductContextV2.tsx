import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BackupPayload, CategoryType, GlobalTargets, Product } from '../types';
import { apiRequest } from '../lib/api';

interface ProductContextType {
  products: Product[];
  activeProduct: Product | null;
  globalTargets: GlobalTargets;
  isLoading: boolean;
  error: string | null;
  dismissError: () => void;
  updateGlobalTargets: (targets: Partial<GlobalTargets>) => void;
  setActiveProductById: (id: string | null) => void;
  addProduct: (name: string) => void;
  duplicateProduct: (id: string) => void;
  reorderProducts: (productIds: string[]) => void;
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
  updateFunnelTarget: (
    productId: string,
    category: CategoryType,
    funnelId: string,
    value: number
  ) => void;
  updateFunnelParent: (productId: string, funnelId: string, parentFunnelId: string | null) => void;
  reorderFunnels: (productId: string, funnelIds: string[]) => void;
  addFunnel: (productId: string, name: string) => void;
  removeFunnel: (productId: string, funnelId: string) => void;
  updateFunnelName: (productId: string, funnelId: string, name: string) => void;
  reorderChannels: (productId: string, channelIds: string[]) => void;
  addChannel: (productId: string, name: string) => void;
  removeChannel: (productId: string, channelId: string) => void;
  updateChannelName: (productId: string, channelId: string, name: string) => void;
  updateChannelColumnWidth: (productId: string, width: number) => void;
  exportBackup: () => Promise<BackupPayload>;
  importBackup: (payload: BackupPayload) => Promise<void>;
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

function sortProduct(product: Product): Product {
  return {
    ...product,
    funnels: [...product.funnels].sort((a, b) => a.position - b.position),
    channels: [...product.channels].sort((a, b) => a.position - b.position),
  };
}

function sortProducts(products: Product[]) {
  return [...products].map(sortProduct).sort((a, b) => a.position - b.position);
}

export const ProductProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [globalTargets, setGlobalTargets] = useState<GlobalTargets>({
    revenue: 1000000,
    newCustomers: 50000,
    existingCustomers: 100000,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const productMutationVersions = useRef<Record<string, number>>({});
  const targetMutationVersion = useRef(0);

  const activeProduct = products.find((p) => p.id === activeProductId) || null;

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((error: unknown) => {
    console.error(error);
    setError(error instanceof Error ? error.message : 'Something went wrong');
  }, []);

  const setSortedProducts = useCallback((nextProducts: Product[]) => {
    setProducts(sortProducts(nextProducts));
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

  const reloadProduct = useCallback(
    async (productId: string) => {
      try {
        const product = await fetchProduct(productId);
        replaceProduct(product);
      } catch (error) {
        handleError(error);
      }
    },
    [fetchProduct, handleError, replaceProduct],
  );

  const reloadGlobalTargets = useCallback(async () => {
    try {
      const response = await apiRequest<DashboardTargetsResponse>('/targets/dashboard');
      setGlobalTargets(response.globalTargets);
    } catch (error) {
      handleError(error);
    }
  }, [handleError]);

  const loadProducts = useCallback(async () => {
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

      setSortedProducts(nextProducts);
      setGlobalTargets(targetsResponse.globalTargets);
      setActiveProductId((current) =>
        current && nextProducts.some((product) => product.id === current) ? current : null,
      );
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchProduct, handleError, setSortedProducts]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const nextProductVersion = useCallback((productId: string) => {
    const nextVersion = (productMutationVersions.current[productId] ?? 0) + 1;
    productMutationVersions.current[productId] = nextVersion;
    return nextVersion;
  }, []);

  const isLatestProductVersion = useCallback((productId: string, version: number) => {
    return productMutationVersions.current[productId] === version;
  }, []);

  const applyOptimisticProductUpdate = useCallback(
    (productId: string, updater: (product: Product) => Product) => {
      setProducts((prev) =>
        sortProducts(prev.map((product) => (product.id === productId ? sortProduct(updater(product)) : product))),
      );
    },
    [],
  );

  const runProductMutation = useCallback(
    (
      productId: string,
      optimisticUpdater: (product: Product) => Product,
      request: () => Promise<ProductResponse>,
    ) => {
      setError(null);
      applyOptimisticProductUpdate(productId, optimisticUpdater);
      const version = nextProductVersion(productId);

      void request()
        .then((response) => {
          if (isLatestProductVersion(productId, version)) {
            replaceProduct(response.product);
          }
        })
        .catch((error) => {
          if (isLatestProductVersion(productId, version)) {
            void reloadProduct(productId);
          }
          handleError(error);
        });
    },
    [
      applyOptimisticProductUpdate,
      handleError,
      isLatestProductVersion,
      nextProductVersion,
      reloadProduct,
      replaceProduct,
    ],
  );

  const setActiveProductById = useCallback((id: string | null) => {
    setActiveProductId(id);
  }, []);

  const updateGlobalTargets = useCallback((targets: Partial<GlobalTargets>) => {
    setError(null);
    targetMutationVersion.current += 1;
    const version = targetMutationVersion.current;

    setGlobalTargets((prev) => ({ ...prev, ...targets }));

    void apiRequest<DashboardTargetsResponse>('/targets/dashboard', {
      method: 'PATCH',
      body: JSON.stringify(targets),
    })
      .then((response) => {
        if (targetMutationVersion.current === version) {
          setGlobalTargets(response.globalTargets);
        }
      })
      .catch((error) => {
        if (targetMutationVersion.current === version) {
          void reloadGlobalTargets();
        }
        handleError(error);
      });
  }, [handleError, reloadGlobalTargets]);

  const addProduct = useCallback((name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setError(null);

    void apiRequest<ProductResponse>('/products', {
      method: 'POST',
      body: JSON.stringify({ name: trimmedName }),
    })
      .then((response) => {
        replaceProduct(response.product);
        setActiveProductId(response.product.id);
      })
      .catch(handleError);
  }, [handleError, replaceProduct]);

  const duplicateProduct = useCallback((id: string) => {
    setError(null);

    void apiRequest<ProductResponse>(`/products/${id}/duplicate`, {
      method: 'POST',
    })
      .then(async (response) => {
        await loadProducts();
        setActiveProductId(response.product.id);
      })
      .catch(handleError);
  }, [handleError, loadProducts]);

  const reorderProducts = useCallback((productIds: string[]) => {
    setError(null);
    setProducts((prev) =>
      sortProducts(productIds.map((id, index) => ({ ...prev.find((product) => product.id === id)!, position: index }))),
    );

    void apiRequest<ProductsResponse>('/products/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ productIds }),
    }).catch((error) => {
      void loadProducts();
      handleError(error);
    });
  }, [handleError, loadProducts]);

  const updateProductName = useCallback((id: string, name: string) => {
    runProductMutation(
      id,
      (product) => ({ ...product, name }),
      () =>
        apiRequest<ProductResponse>(`/products/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name }),
        }),
    );
  }, [runProductMutation]);

  const deleteProduct = useCallback((id: string) => {
    setError(null);

    void apiRequest<void>(`/products/${id}`, {
      method: 'DELETE',
    })
      .then(() => {
        setProducts((prev) => {
          const filtered = sortProducts(
            prev
              .filter((product) => product.id !== id)
              .map((product, index) => ({ ...product, position: index })),
          );
          setActiveProductId((current) => {
            if (current !== id) return current;
            return filtered[0]?.id ?? null;
          });
          return filtered;
        });
      })
      .catch(handleError);
  }, [handleError]);

  const updateCellData = useCallback(
    (productId: string, category: CategoryType, funnelId: string, channelId: string, field: 'visits' | 'revenue', value: number) => {
      runProductMutation(
        productId,
        (product) => {
          const nextCategory = { ...product.data[category] };
          const nextFunnel = nextCategory[funnelId] ? { ...nextCategory[funnelId] } : {};
          const nextChannel = nextFunnel[channelId]
            ? { ...nextFunnel[channelId] }
            : { visits: 0, revenue: 0 };

          nextChannel[field] = value;
          nextFunnel[channelId] = nextChannel;
          nextCategory[funnelId] = nextFunnel;

          return {
            ...product,
            data: {
              ...product.data,
              [category]: nextCategory,
            },
          };
        },
        () =>
          apiRequest<ProductResponse>(
            `/products/${productId}/input-values/${category}/${funnelId}/${channelId}`,
            {
              method: 'PATCH',
              body: JSON.stringify({ [field]: value }),
            },
          ),
      );
    },
    [runProductMutation]
  );

  const updateFunnelTarget = useCallback((
    productId: string,
    category: CategoryType,
    funnelId: string,
    value: number,
  ) => {
    runProductMutation(
      productId,
      (product) => ({
        ...product,
        funnels: product.funnels.map((funnel) =>
          funnel.id === funnelId
            ? {
                ...funnel,
                targets: {
                  ...funnel.targets,
                  [category]: value,
                },
              }
            : funnel,
        ),
      }),
      () =>
        apiRequest<ProductResponse>(`/products/${productId}/funnels/${funnelId}`, {
          method: 'PATCH',
          body: JSON.stringify({ category, target: value }),
        }),
    );
  }, [runProductMutation]);

  const updateFunnelParent = useCallback((productId: string, funnelId: string, parentFunnelId: string | null) => {
    runProductMutation(
      productId,
      (product) => ({
        ...product,
        funnels: product.funnels.map((funnel) =>
          funnel.id === funnelId ? { ...funnel, parentFunnelId } : funnel,
        ),
      }),
      () =>
        apiRequest<ProductResponse>(`/products/${productId}/funnels/${funnelId}`, {
          method: 'PATCH',
          body: JSON.stringify({ parentFunnelId }),
        }),
    );
  }, [runProductMutation]);

  const addFunnel = useCallback((productId: string, name: string) => {
    setError(null);

    void apiRequest<ProductResponse>(`/products/${productId}/funnels`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
      .then((response) => {
        replaceProduct(response.product);
      })
      .catch(handleError);
  }, [handleError, replaceProduct]);

  const reorderFunnels = useCallback((productId: string, funnelIds: string[]) => {
    runProductMutation(
      productId,
      (product) => ({
        ...product,
        funnels: funnelIds.map((id, index) => ({
          ...product.funnels.find((funnel) => funnel.id === id)!,
          position: index,
        })),
      }),
      () =>
        apiRequest<ProductResponse>(`/products/${productId}/funnels/reorder`, {
          method: 'PATCH',
          body: JSON.stringify({ funnelIds }),
        }),
    );
  }, [runProductMutation]);

  const removeFunnel = useCallback((productId: string, funnelId: string) => {
    setError(null);

    void apiRequest<ProductResponse>(`/products/${productId}/funnels/${funnelId}`, {
      method: 'DELETE',
    })
      .then((response) => {
        replaceProduct(response.product);
      })
      .catch(handleError);
  }, [handleError, replaceProduct]);

  const updateFunnelName = useCallback((productId: string, funnelId: string, name: string) => {
    runProductMutation(
      productId,
      (product) => ({
        ...product,
        funnels: product.funnels.map((funnel) =>
          funnel.id === funnelId ? { ...funnel, name } : funnel,
        ),
      }),
      () =>
        apiRequest<ProductResponse>(`/products/${productId}/funnels/${funnelId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name }),
        }),
    );
  }, [runProductMutation]);

  const addChannel = useCallback((productId: string, name: string) => {
    setError(null);

    void apiRequest<ProductResponse>(`/products/${productId}/channels`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
      .then((response) => {
        replaceProduct(response.product);
      })
      .catch(handleError);
  }, [handleError, replaceProduct]);

  const reorderChannels = useCallback((productId: string, channelIds: string[]) => {
    runProductMutation(
      productId,
      (product) => ({
        ...product,
        channels: channelIds.map((id, index) => ({
          ...product.channels.find((channel) => channel.id === id)!,
          position: index,
        })),
      }),
      () =>
        apiRequest<ProductResponse>(`/products/${productId}/channels/reorder`, {
          method: 'PATCH',
          body: JSON.stringify({ channelIds }),
        }),
    );
  }, [runProductMutation]);

  const removeChannel = useCallback((productId: string, channelId: string) => {
    setError(null);

    void apiRequest<ProductResponse>(`/products/${productId}/channels/${channelId}`, {
      method: 'DELETE',
    })
      .then((response) => {
        replaceProduct(response.product);
      })
      .catch(handleError);
  }, [handleError, replaceProduct]);

  const updateChannelName = useCallback((productId: string, channelId: string, name: string) => {
    runProductMutation(
      productId,
      (product) => ({
        ...product,
        channels: product.channels.map((channel) =>
          channel.id === channelId ? { ...channel, name } : channel,
        ),
      }),
      () =>
        apiRequest<ProductResponse>(`/products/${productId}/channels/${channelId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name }),
        }),
    );
  }, [runProductMutation]);

  const updateChannelColumnWidth = useCallback((productId: string, width: number) => {
    runProductMutation(
      productId,
      (product) => ({
        ...product,
        layout: {
          ...product.layout,
          channelColumnWidth: width,
        },
      }),
      () =>
        apiRequest<ProductResponse>(`/products/${productId}/layout`, {
          method: 'PATCH',
          body: JSON.stringify({ channelColumnWidth: width }),
        }),
    );
  }, [runProductMutation]);

  const exportBackup = useCallback(async () => {
    return apiRequest<BackupPayload>('/backup/export');
  }, []);

  const importBackup = useCallback(async (payload: BackupPayload) => {
    setError(null);
    const response = await apiRequest<BackupImportResponse>('/backup/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const sortedProducts = sortProducts(response.products);
    setProducts(sortedProducts);
    setGlobalTargets(response.globalTargets);
    setActiveProductId(sortedProducts[0]?.id ?? null);
  }, []);

  return (
    <ProductContext.Provider
      value={{
        products,
        activeProduct,
        globalTargets,
        isLoading,
        error,
        dismissError,
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
