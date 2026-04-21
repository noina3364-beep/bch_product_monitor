import { Prisma, ProductCategory, type PrismaClient } from '@prisma/client';
import {
  BACKUP_VERSION,
  CATEGORY_KEYS,
  DASHBOARD_TARGET_ID,
  DEFAULT_CHANNEL_COLUMN_WIDTH,
  MAX_CHANNELS_PER_PRODUCT,
  MAX_FUNNELS_PER_PRODUCT,
  type CategoryKey,
  type PeriodView,
} from './constants.js';
import { AppError } from './errors.js';
import {
  formatDateKey,
  getCurrentWeekStartKey,
  getIncludedWeekKeys,
  getPeriodLabel,
  parseDateKey,
} from './periods.js';
import type {
  BackupPayload,
  DashboardResponse,
  GlobalTargetsDto,
  ProductCategoryDto,
  ProductDto,
} from './types.js';

const productGraphInclude = Prisma.validator<Prisma.ProductInclude>()({
  categories: {
    include: {
      funnels: {
        orderBy: {
          position: 'asc',
        },
      },
      channels: {
        orderBy: {
          position: 'asc',
        },
      },
      weeklyInputs: {
        orderBy: [{ weekStartDate: 'asc' }, { funnel: { position: 'asc' } }, { channel: { position: 'asc' } }],
      },
    },
  },
});

const legacyProductInclude = Prisma.validator<Prisma.LegacySharedProductInclude>()({
  funnels: {
    include: {
      target: true,
    },
    orderBy: {
      position: 'asc',
    },
  },
  channels: {
    orderBy: {
      position: 'asc',
    },
  },
  inputValues: {
    orderBy: [{ category: 'asc' }, { funnel: { position: 'asc' } }, { channel: { position: 'asc' } }],
  },
});

type ProductGraph = Prisma.ProductGetPayload<{
  include: typeof productGraphInclude;
}>;

type LegacyProductGraph = Prisma.LegacySharedProductGetPayload<{
  include: typeof legacyProductInclude;
}>;

type DbClient = PrismaClient | Prisma.TransactionClient;

const CATEGORY_ENUM_MAP: Record<CategoryKey, ProductCategory> = {
  new: ProductCategory.new,
  existing: ProductCategory.existing,
};

const LEGACY_CATEGORY_MAP: Record<CategoryKey, 'newChannels' | 'existingChannels'> = {
  new: 'newChannels',
  existing: 'existingChannels',
};

function hasSequentialPositions(items: Array<{ position: number }>) {
  return items.every((item, index) => item.position === index);
}

function assertUniqueIds(ids: string[], label: string) {
  if (new Set(ids).size !== ids.length) {
    throw new AppError(`${label} must be unique`, 400);
  }
}

function assertExactIdList(provided: string[], expected: string[], label: string) {
  if (provided.length !== expected.length) {
    throw new AppError(`Expected ${expected.length} ${label}`, 400);
  }

  assertUniqueIds(provided, label);
  const expectedSet = new Set(expected);

  if (provided.some((id) => !expectedSet.has(id))) {
    throw new AppError(`Invalid ${label}`, 400);
  }
}

function assertNoFunnelCycle(
  funnels: Array<{ id: string; parentFunnelId: string | null }>,
  funnelId: string,
  parentFunnelId: string | null,
) {
  if (parentFunnelId === null) {
    return;
  }

  if (parentFunnelId === funnelId) {
    throw new AppError('A funnel cannot be based on itself', 400);
  }

  const funnelMap = new Map(funnels.map((funnel) => [funnel.id, funnel.parentFunnelId]));

  if (!funnelMap.has(parentFunnelId)) {
    throw new AppError('Parent funnel not found', 400);
  }

  funnelMap.set(funnelId, parentFunnelId);

  const seen = new Set<string>([funnelId]);
  let currentId: string | null = parentFunnelId;

  while (currentId !== null) {
    if (seen.has(currentId)) {
      throw new AppError('Funnel relationship cannot contain a cycle', 400);
    }

    seen.add(currentId);
    currentId = funnelMap.get(currentId) ?? null;
  }
}

function getDuplicateProductName(baseName: string, existingNames: string[]) {
  const existing = new Set(existingNames);
  const copyBase = `${baseName} (Copy)`;

  if (!existing.has(copyBase)) {
    return copyBase;
  }

  let counter = 2;
  while (existing.has(`${baseName} (Copy ${counter})`)) {
    counter += 1;
  }

  return `${baseName} (Copy ${counter})`;
}

function getCategoryStateOrThrow(product: ProductGraph, category: CategoryKey) {
  const state = product.categories.find((entry) => entry.category === CATEGORY_ENUM_MAP[category]);
  if (!state) {
    throw new AppError(`Category ${category} not found`, 404);
  }

  return state;
}

function mapCategoryState(state: ProductGraph['categories'][number], key: CategoryKey): ProductCategoryDto {
  const weeks: ProductCategoryDto['weeks'] = {};

  for (const row of state.weeklyInputs) {
    const weekKey = formatDateKey(row.weekStartDate);
    weeks[weekKey] ??= {};
    weeks[weekKey][row.funnelId] ??= {};
    weeks[weekKey][row.funnelId][row.channelId] = {
      visits: row.visits,
      revenue: row.revenue,
    };
  }

  return {
    id: state.id,
    key,
    layout: {
      channelColumnWidth: state.channelColumnWidth,
    },
    funnels: state.funnels.map((funnel) => ({
      id: funnel.id,
      name: funnel.name,
      position: funnel.position,
      parentFunnelId: funnel.parentFunnelId,
      targetVisits: funnel.targetVisits,
    })),
    channels: state.channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      position: channel.position,
    })),
    weeks,
  };
}

export function mapProduct(product: ProductGraph): ProductDto {
  return {
    id: product.id,
    name: product.name,
    position: product.position,
    categories: {
      new: mapCategoryState(getCategoryStateOrThrow(product, 'new'), 'new'),
      existing: mapCategoryState(getCategoryStateOrThrow(product, 'existing'), 'existing'),
    },
  };
}

function getIncludedWeekSet(view: PeriodView, referenceDate: string) {
  return new Set(getIncludedWeekKeys(view, referenceDate));
}

function getCategoryActuals(category: ProductCategoryDto, view: PeriodView, referenceDate: string) {
  const includedWeeks = getIncludedWeekSet(view, referenceDate);
  let revenue = 0;
  let visits = 0;

  for (const [weekKey, funnelMap] of Object.entries(category.weeks)) {
    if (!includedWeeks.has(weekKey)) {
      continue;
    }

    for (const channelMap of Object.values(funnelMap)) {
      for (const cell of Object.values(channelMap)) {
        revenue += cell.revenue;
        visits += cell.visits;
      }
    }
  }

  return { revenue, visits };
}

export function computeDashboard(
  products: ProductDto[],
  globalTargets: GlobalTargetsDto,
  view: PeriodView,
  referenceDate: string,
): DashboardResponse {
  const includedWeeks = getIncludedWeekKeys(view, referenceDate);
  const multiplier = includedWeeks.length;
  const productBreakdown = products.map((product) => {
    const next = {
      id: product.id,
      name: product.name,
      revenue: 0,
      newVisits: 0,
      existingVisits: 0,
    };

    const newActuals = getCategoryActuals(product.categories.new, view, referenceDate);
    const existingActuals = getCategoryActuals(product.categories.existing, view, referenceDate);

    next.revenue = newActuals.revenue + existingActuals.revenue;
    next.newVisits = newActuals.visits;
    next.existingVisits = existingActuals.visits;
    return next;
  });

  const globalActuals = productBreakdown.reduce(
    (accumulator, product) => {
      accumulator.revenue += product.revenue;
      accumulator.newVisits += product.newVisits;
      accumulator.existingVisits += product.existingVisits;
      return accumulator;
    },
    { revenue: 0, newVisits: 0, existingVisits: 0 },
  );

  return {
    globalTargets: {
      revenue: globalTargets.revenue * multiplier,
      newCustomers: globalTargets.newCustomers * multiplier,
      existingCustomers: globalTargets.existingCustomers * multiplier,
    },
    period: {
      view,
      referenceDate,
      label: getPeriodLabel(view, referenceDate),
      includedWeeks,
    },
    globalActuals,
    productBreakdown,
  };
}

export async function ensureDashboardTargets(db: DbClient) {
  return db.dashboardTarget.upsert({
    where: { id: DASHBOARD_TARGET_ID },
    create: {
      id: DASHBOARD_TARGET_ID,
      revenueTarget: 1_000_000,
      newCustomersTarget: 50_000,
      existingCustomersTarget: 100_000,
    },
    update: {},
  });
}

export function toGlobalTargetsDto(targets: {
  revenueTarget: number;
  newCustomersTarget: number;
  existingCustomersTarget: number;
}): GlobalTargetsDto {
  return {
    revenue: targets.revenueTarget,
    newCustomers: targets.newCustomersTarget,
    existingCustomers: targets.existingCustomersTarget,
  };
}

export function assertName(name: string) {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new AppError('Name is required', 400);
  }

  return trimmed;
}

async function createDefaultCategoryState(
  db: DbClient,
  productId: string,
  category: CategoryKey,
  names?: { funnelName?: string; channelName?: string },
) {
  const weekStartDate = parseDateKey(getCurrentWeekStartKey());
  const state = await db.productCategoryState.create({
    data: {
      productId,
      category: CATEGORY_ENUM_MAP[category],
      channelColumnWidth: DEFAULT_CHANNEL_COLUMN_WIDTH,
    },
  });

  const funnel = await db.productFunnel.create({
    data: {
      categoryStateId: state.id,
      name: names?.funnelName ?? 'Funnel 1',
      position: 0,
      parentFunnelId: null,
      targetVisits: 0,
    },
  });

  const channel = await db.productChannel.create({
    data: {
      categoryStateId: state.id,
      name: names?.channelName ?? 'Channel 1',
      position: 0,
    },
  });

  await db.weeklyInputValue.create({
    data: {
      categoryStateId: state.id,
      funnelId: funnel.id,
      channelId: channel.id,
      weekStartDate,
      visits: 0,
      revenue: 0,
    },
  });
}

export async function migrateLegacyDataIfNeeded(db: DbClient) {
  const activeCount = await db.product.count();
  if (activeCount > 0) {
    return;
  }

  const legacyProducts = await db.legacySharedProduct.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: legacyProductInclude,
  });

  if (legacyProducts.length === 0) {
    return;
  }

  const weekStartDate = parseDateKey(getCurrentWeekStartKey());

  for (const legacyProduct of legacyProducts) {
    const createdProduct = await db.product.create({
      data: {
        name: legacyProduct.name,
        position: legacyProduct.position,
      },
    });

    for (const category of CATEGORY_KEYS) {
      const state = await db.productCategoryState.create({
        data: {
          productId: createdProduct.id,
          category: CATEGORY_ENUM_MAP[category],
          channelColumnWidth: legacyProduct.channelColumnWidth,
        },
      });

      const funnelIdMap = new Map<string, string>();
      const channelIdMap = new Map<string, string>();

      for (const legacyFunnel of legacyProduct.funnels) {
        const createdFunnel = await db.productFunnel.create({
          data: {
            categoryStateId: state.id,
            name: legacyFunnel.name,
            position: legacyFunnel.position,
            parentFunnelId: null,
            targetVisits:
              category === 'new'
                ? legacyFunnel.target?.newTargetVisits ?? legacyFunnel.target?.targetVisits ?? 0
                : legacyFunnel.target?.existingTargetVisits ?? legacyFunnel.target?.targetVisits ?? 0,
          },
        });

        funnelIdMap.set(legacyFunnel.id, createdFunnel.id);
      }

      for (const legacyChannel of legacyProduct.channels) {
        const createdChannel = await db.productChannel.create({
          data: {
            categoryStateId: state.id,
            name: legacyChannel.name,
            position: legacyChannel.position,
          },
        });

        channelIdMap.set(legacyChannel.id, createdChannel.id);
      }

      await Promise.all(
        legacyProduct.funnels.map((legacyFunnel) =>
          db.productFunnel.update({
            where: { id: funnelIdMap.get(legacyFunnel.id)! },
            data: {
              parentFunnelId: legacyFunnel.parentFunnelId
                ? funnelIdMap.get(legacyFunnel.parentFunnelId) ?? null
                : null,
            },
          }),
        ),
      );

      const rows = legacyProduct.inputValues
        .filter((row) => row.category === LEGACY_CATEGORY_MAP[category])
        .map((row) => ({
          categoryStateId: state.id,
          funnelId: funnelIdMap.get(row.funnelId)!,
          channelId: channelIdMap.get(row.channelId)!,
          weekStartDate,
          visits: row.visits,
          revenue: row.revenue,
        }));

      if (rows.length > 0) {
        await db.weeklyInputValue.createMany({ data: rows });
      }
    }
  }
}

export async function ensureProductPositions(db: DbClient) {
  const products = await db.product.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, position: true },
  });

  if (hasSequentialPositions(products)) {
    return;
  }

  await Promise.all(
    products.map((product, index) =>
      db.product.update({
        where: { id: product.id },
        data: { position: index },
      }),
    ),
  );
}

export async function ensureDataIntegrity(db: DbClient) {
  await migrateLegacyDataIfNeeded(db);
  await ensureProductPositions(db);
}

export async function getProductGraphOrThrow(db: DbClient, productId: string) {
  await ensureDataIntegrity(db);

  const product = await db.product.findUnique({
    where: { id: productId },
    include: productGraphInclude,
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  return product;
}

export async function listProductSummaries(db: DbClient) {
  await ensureDataIntegrity(db);

  return db.product.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      position: true,
    },
  });
}

export async function createProduct(db: DbClient, name: string) {
  await ensureDataIntegrity(db);
  const trimmedName = assertName(name);
  const position = await db.product.count();

  const product = await db.product.create({
    data: {
      name: trimmedName,
      position,
    },
  });

  await createDefaultCategoryState(db, product.id, 'new');
  await createDefaultCategoryState(db, product.id, 'existing');

  return getProductGraphOrThrow(db, product.id);
}

async function getCategoryGraphOrThrow(db: DbClient, productId: string, category: CategoryKey) {
  const product = await getProductGraphOrThrow(db, productId);
  return getCategoryStateOrThrow(product, category);
}

export async function addFunnel(db: DbClient, productId: string, category: CategoryKey, name: string) {
  const categoryState = await getCategoryGraphOrThrow(db, productId, category);

  if (categoryState.funnels.length >= MAX_FUNNELS_PER_PRODUCT) {
    throw new AppError(`Categories can have at most ${MAX_FUNNELS_PER_PRODUCT} funnels`, 409);
  }

  const createdFunnel = await db.productFunnel.create({
    data: {
      categoryStateId: categoryState.id,
      name: assertName(name),
      position: categoryState.funnels.length,
      parentFunnelId: categoryState.funnels.at(-1)?.id ?? null,
      targetVisits: 0,
    },
  });

  const currentWeek = parseDateKey(getCurrentWeekStartKey());
  if (categoryState.channels.length > 0) {
    await db.weeklyInputValue.createMany({
      data: categoryState.channels.map((channel) => ({
        categoryStateId: categoryState.id,
        funnelId: createdFunnel.id,
        channelId: channel.id,
        weekStartDate: currentWeek,
        visits: 0,
        revenue: 0,
      })),
    });
  }

  return getProductGraphOrThrow(db, productId);
}

export async function addChannel(db: DbClient, productId: string, category: CategoryKey, name: string) {
  const categoryState = await getCategoryGraphOrThrow(db, productId, category);

  if (categoryState.channels.length >= MAX_CHANNELS_PER_PRODUCT) {
    throw new AppError(`Categories can have at most ${MAX_CHANNELS_PER_PRODUCT} channels`, 409);
  }

  const createdChannel = await db.productChannel.create({
    data: {
      categoryStateId: categoryState.id,
      name: assertName(name),
      position: categoryState.channels.length,
    },
  });

  const currentWeek = parseDateKey(getCurrentWeekStartKey());
  if (categoryState.funnels.length > 0) {
    await db.weeklyInputValue.createMany({
      data: categoryState.funnels.map((funnel) => ({
        categoryStateId: categoryState.id,
        funnelId: funnel.id,
        channelId: createdChannel.id,
        weekStartDate: currentWeek,
        visits: 0,
        revenue: 0,
      })),
    });
  }

  return getProductGraphOrThrow(db, productId);
}

async function compactProductPositions(db: DbClient) {
  const products = await db.product.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });

  await Promise.all(
    products.map((product, index) =>
      db.product.update({
        where: { id: product.id },
        data: { position: index },
      }),
    ),
  );
}

async function compactCategoryPositions(db: DbClient, categoryStateId: string, entity: 'funnel' | 'channel') {
  if (entity === 'funnel') {
    const funnels = await db.productFunnel.findMany({
      where: { categoryStateId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });

    await Promise.all(
      funnels.map((funnel, index) =>
        db.productFunnel.update({
          where: { id: funnel.id },
          data: { position: index },
        }),
      ),
    );

    return;
  }

  const channels = await db.productChannel.findMany({
    where: { categoryStateId },
    orderBy: { position: 'asc' },
    select: { id: true },
  });

  await Promise.all(
    channels.map((channel, index) =>
      db.productChannel.update({
        where: { id: channel.id },
        data: { position: index },
      }),
    ),
  );
}

export async function reorderProducts(db: DbClient, productIds: string[]) {
  const products = await listProductSummaries(db);
  assertExactIdList(
    productIds,
    products.map((product) => product.id),
    'product ids',
  );

  await Promise.all(
    productIds.map((id, index) =>
      db.product.update({
        where: { id },
        data: { position: index },
      }),
    ),
  );

  return listProductSummaries(db);
}

export async function reorderFunnels(
  db: DbClient,
  productId: string,
  category: CategoryKey,
  funnelIds: string[],
) {
  const categoryState = await getCategoryGraphOrThrow(db, productId, category);
  assertExactIdList(
    funnelIds,
    categoryState.funnels.map((funnel) => funnel.id),
    'funnel ids',
  );

  await Promise.all(
    funnelIds.map((id, index) =>
      db.productFunnel.update({
        where: { id },
        data: { position: index },
      }),
    ),
  );

  return getProductGraphOrThrow(db, productId);
}

export async function reorderChannels(
  db: DbClient,
  productId: string,
  category: CategoryKey,
  channelIds: string[],
) {
  const categoryState = await getCategoryGraphOrThrow(db, productId, category);
  assertExactIdList(
    channelIds,
    categoryState.channels.map((channel) => channel.id),
    'channel ids',
  );

  await Promise.all(
    channelIds.map((id, index) =>
      db.productChannel.update({
        where: { id },
        data: { position: index },
      }),
    ),
  );

  return getProductGraphOrThrow(db, productId);
}

export async function deleteProductAndCompact(db: DbClient, productId: string) {
  await db.product.delete({
    where: { id: productId },
  });

  await compactProductPositions(db);
}

export async function deleteFunnel(
  db: DbClient,
  productId: string,
  category: CategoryKey,
  funnelId: string,
) {
  const categoryState = await getCategoryGraphOrThrow(db, productId, category);

  if (categoryState.funnels.length <= 1) {
    throw new AppError('Cannot delete the last remaining funnel', 409);
  }

  const funnel = categoryState.funnels.find((entry) => entry.id === funnelId);
  if (!funnel) {
    throw new AppError('Funnel not found', 404);
  }

  await db.productFunnel.delete({
    where: { id: funnelId },
  });

  await compactCategoryPositions(db, categoryState.id, 'funnel');

  const orphanFunnels = await db.productFunnel.findMany({
    where: {
      categoryStateId: categoryState.id,
      parentFunnelId: funnelId,
    },
    orderBy: { position: 'asc' },
    select: { id: true, position: true },
  });

  await Promise.all(
    orphanFunnels.map((entry) =>
      db.productFunnel.update({
        where: { id: entry.id },
        data: {
          parentFunnelId:
            entry.position === 0
              ? null
              : (
                  categoryState.funnels
                    .filter((candidate) => candidate.id !== funnelId)
                    .sort((a, b) => a.position - b.position)[entry.position - 1]?.id ?? null
                ),
        },
      }),
    ),
  );

  return getProductGraphOrThrow(db, productId);
}

export async function deleteChannel(
  db: DbClient,
  productId: string,
  category: CategoryKey,
  channelId: string,
) {
  const categoryState = await getCategoryGraphOrThrow(db, productId, category);

  if (categoryState.channels.length <= 1) {
    throw new AppError('Cannot delete the last remaining channel', 409);
  }

  const channel = categoryState.channels.find((entry) => entry.id === channelId);
  if (!channel) {
    throw new AppError('Channel not found', 404);
  }

  await db.productChannel.delete({
    where: { id: channelId },
  });

  await compactCategoryPositions(db, categoryState.id, 'channel');
  return getProductGraphOrThrow(db, productId);
}

export async function updateProductLayout(
  db: DbClient,
  productId: string,
  category: CategoryKey,
  channelColumnWidth: number,
) {
  const categoryState = await getCategoryGraphOrThrow(db, productId, category);

  await db.productCategoryState.update({
    where: { id: categoryState.id },
    data: { channelColumnWidth },
  });

  return getProductGraphOrThrow(db, productId);
}

async function duplicateCategoryState(
  db: DbClient,
  sourceState: ProductGraph['categories'][number],
  productId: string,
  category: ProductCategory,
) {
  const duplicatedState = await db.productCategoryState.create({
    data: {
      productId,
      category,
      channelColumnWidth: sourceState.channelColumnWidth,
    },
  });

  const funnelIdMap = new Map<string, string>();
  for (const funnel of sourceState.funnels) {
    const createdFunnel = await db.productFunnel.create({
      data: {
        categoryStateId: duplicatedState.id,
        name: funnel.name,
        position: funnel.position,
        parentFunnelId: null,
        targetVisits: funnel.targetVisits,
      },
    });

    funnelIdMap.set(funnel.id, createdFunnel.id);
  }

  const channelIdMap = new Map<string, string>();
  for (const channel of sourceState.channels) {
    const createdChannel = await db.productChannel.create({
      data: {
        categoryStateId: duplicatedState.id,
        name: channel.name,
        position: channel.position,
      },
    });

    channelIdMap.set(channel.id, createdChannel.id);
  }

  await Promise.all(
    sourceState.funnels.map((funnel) =>
      db.productFunnel.update({
        where: {
          id: funnelIdMap.get(funnel.id)!,
        },
        data: {
          parentFunnelId: funnel.parentFunnelId ? funnelIdMap.get(funnel.parentFunnelId) ?? null : null,
        },
      }),
    ),
  );

  if (sourceState.weeklyInputs.length > 0) {
    await db.weeklyInputValue.createMany({
      data: sourceState.weeklyInputs.map((row) => ({
        categoryStateId: duplicatedState.id,
        funnelId: funnelIdMap.get(row.funnelId)!,
        channelId: channelIdMap.get(row.channelId)!,
        weekStartDate: row.weekStartDate,
        visits: row.visits,
        revenue: row.revenue,
      })),
    });
  }
}

export async function duplicateProduct(db: DbClient, productId: string) {
  await ensureDataIntegrity(db);
  const source = await getProductGraphOrThrow(db, productId);
  const products = await db.product.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, position: true },
  });

  const duplicateName = getDuplicateProductName(
    source.name,
    products.filter((product) => product.id !== source.id).map((product) => product.name),
  );
  const insertPosition = source.position + 1;

  await Promise.all(
    products
      .filter((product) => product.position >= insertPosition)
      .map((product) =>
        db.product.update({
          where: { id: product.id },
          data: { position: product.position + 1 },
        }),
      ),
  );

  const duplicatedProduct = await db.product.create({
    data: {
      name: duplicateName,
      position: insertPosition,
    },
  });

  await duplicateCategoryState(db, getCategoryStateOrThrow(source, 'new'), duplicatedProduct.id, ProductCategory.new);
  await duplicateCategoryState(
    db,
    getCategoryStateOrThrow(source, 'existing'),
    duplicatedProduct.id,
    ProductCategory.existing,
  );

  return getProductGraphOrThrow(db, duplicatedProduct.id);
}

export async function updateFunnelParent(
  db: DbClient,
  productId: string,
  category: CategoryKey,
  funnelId: string,
  parentFunnelId: string | null,
) {
  const categoryState = await getCategoryGraphOrThrow(db, productId, category);
  const funnel = categoryState.funnels.find((entry) => entry.id === funnelId);

  if (!funnel) {
    throw new AppError('Funnel not found', 404);
  }

  assertNoFunnelCycle(
    categoryState.funnels.map((entry) => ({
      id: entry.id,
      parentFunnelId: entry.parentFunnelId,
    })),
    funnelId,
    parentFunnelId,
  );

  await db.productFunnel.update({
    where: { id: funnelId },
    data: { parentFunnelId },
  });

  return getProductGraphOrThrow(db, productId);
}

function assertBackupCategoryData(category: ProductCategoryDto) {
  const funnelIds = category.funnels.map((funnel) => funnel.id);
  const channelIds = category.channels.map((channel) => channel.id);

  assertUniqueIds(funnelIds, 'Funnel ids');
  assertUniqueIds(channelIds, 'Channel ids');

  if (!hasSequentialPositions([...category.funnels].sort((a, b) => a.position - b.position))) {
    throw new AppError(`Invalid funnel positions for category ${category.key}`, 400);
  }

  if (!hasSequentialPositions([...category.channels].sort((a, b) => a.position - b.position))) {
    throw new AppError(`Invalid channel positions for category ${category.key}`, 400);
  }

  for (const funnel of category.funnels) {
    assertNoFunnelCycle(
      category.funnels.map((entry) => ({
        id: entry.id,
        parentFunnelId: entry.parentFunnelId,
      })),
      funnel.id,
      funnel.parentFunnelId,
    );
  }

  for (const [weekKey, funnelMap] of Object.entries(category.weeks)) {
    parseDateKey(weekKey);

    for (const [funnelId, channelMap] of Object.entries(funnelMap)) {
      if (!funnelIds.includes(funnelId)) {
        throw new AppError(`Backup contains unknown funnel ${funnelId}`, 400);
      }

      for (const channelId of Object.keys(channelMap)) {
        if (!channelIds.includes(channelId)) {
          throw new AppError(`Backup contains unknown channel ${channelId}`, 400);
        }
      }
    }
  }
}

function assertBackupProductData(product: ProductDto) {
  assertBackupCategoryData(product.categories.new);
  assertBackupCategoryData(product.categories.existing);
}

async function restoreCategoryBackup(
  db: DbClient,
  productId: string,
  category: ProductCategoryDto,
) {
  await db.productCategoryState.create({
    data: {
      id: category.id,
      productId,
      category: CATEGORY_ENUM_MAP[category.key],
      channelColumnWidth: category.layout.channelColumnWidth,
      funnels: {
        create: category.funnels
          .sort((a, b) => a.position - b.position)
          .map((funnel) => ({
            id: funnel.id,
            name: funnel.name,
            position: funnel.position,
            parentFunnelId: null,
            targetVisits: funnel.targetVisits,
          })),
      },
      channels: {
        create: category.channels
          .sort((a, b) => a.position - b.position)
          .map((channel) => ({
            id: channel.id,
            name: channel.name,
            position: channel.position,
          })),
      },
    },
  });

  await Promise.all(
    category.funnels.map((funnel) =>
      db.productFunnel.update({
        where: { id: funnel.id },
        data: {
          parentFunnelId: funnel.parentFunnelId,
        },
      }),
    ),
  );

  const rows = Object.entries(category.weeks).flatMap(([weekKey, funnelMap]) =>
    Object.entries(funnelMap).flatMap(([funnelId, channelMap]) =>
      Object.entries(channelMap).map(([channelId, cell]) => ({
        categoryStateId: category.id,
        funnelId,
        channelId,
        weekStartDate: parseDateKey(weekKey),
        visits: cell.visits,
        revenue: cell.revenue,
      })),
    ),
  );

  if (rows.length > 0) {
    await db.weeklyInputValue.createMany({ data: rows });
  }
}

export async function restoreBackup(db: DbClient, backup: BackupPayload) {
  assertUniqueIds(backup.products.map((product) => product.id), 'Product ids');
  assertUniqueIds(backup.products.map((product) => String(product.position)), 'Product positions');

  const sortedProducts = [...backup.products].sort((a, b) => a.position - b.position);
  if (!hasSequentialPositions(sortedProducts)) {
    throw new AppError('Backup product positions must be sequential', 400);
  }

  for (const product of sortedProducts) {
    assertBackupProductData(product);
  }

  await db.weeklyInputValue.deleteMany();
  await db.productChannel.deleteMany();
  await db.productFunnel.deleteMany();
  await db.productCategoryState.deleteMany();
  await db.product.deleteMany();
  await db.dashboardTarget.deleteMany();

  await db.dashboardTarget.create({
    data: {
      id: DASHBOARD_TARGET_ID,
      revenueTarget: backup.globalTargets.revenue,
      newCustomersTarget: backup.globalTargets.newCustomers,
      existingCustomersTarget: backup.globalTargets.existingCustomers,
    },
  });

  for (const product of sortedProducts) {
    await db.product.create({
      data: {
        id: product.id,
        name: product.name,
        position: product.position,
      },
    });

    await restoreCategoryBackup(db, product.id, product.categories.new);
    await restoreCategoryBackup(db, product.id, product.categories.existing);
  }
}

export async function getBackupPayload(db: DbClient): Promise<BackupPayload> {
  await ensureDataIntegrity(db);
  const targets = await ensureDashboardTargets(db);
  const products = await db.product.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: productGraphInclude,
  });

  return {
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    periodRules: {
      inputGrain: 'week',
      weekStartsOn: 'monday',
      periodOwnership: 'weekStartDate',
    },
    globalTargets: toGlobalTargetsDto(targets),
    products: products.map(mapProduct),
  };
}

export async function getDashboardPayload(
  db: DbClient,
  view: PeriodView,
  referenceDate: string,
): Promise<DashboardResponse> {
  await ensureDataIntegrity(db);

  const targets = await ensureDashboardTargets(db);
  const products = await db.product.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: productGraphInclude,
  });

  return computeDashboard(products.map(mapProduct), toGlobalTargetsDto(targets), view, referenceDate);
}
