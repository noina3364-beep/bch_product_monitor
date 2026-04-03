import { Prisma, type Category, type PrismaClient } from '@prisma/client';
import {
  BACKUP_VERSION,
  CATEGORY_VALUES,
  DASHBOARD_TARGET_ID,
  DEFAULT_CHANNEL_COLUMN_WIDTH,
  MAX_CHANNELS_PER_PRODUCT,
  MAX_FUNNELS_PER_PRODUCT,
  type CategoryValue,
} from './constants.js';
import { AppError } from './errors.js';
import type { BackupPayload, DashboardResponse, GlobalTargetsDto, ProductDto } from './types.js';

const productGraphInclude = Prisma.validator<Prisma.ProductInclude>()({
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

type DbClient = PrismaClient | Prisma.TransactionClient;

function hasSequentialPositions(items: Array<{ position: number }>) {
  return items.every((item, index) => item.position === index);
}

function buildEmptyProductData(product: Pick<ProductGraph, 'funnels' | 'channels'>): ProductDto['data'] {
  const data: ProductDto['data'] = {
    newChannels: {},
    existingChannels: {},
  };

  for (const category of CATEGORY_VALUES) {
    for (const funnel of product.funnels) {
      data[category][funnel.id] = {};

      for (const channel of product.channels) {
        data[category][funnel.id][channel.id] = {
          visits: 0,
          revenue: 0,
        };
      }
    }
  }

  return data;
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

function assertBackupProductData(product: ProductDto) {
  const funnelIds = product.funnels.map((funnel) => funnel.id);
  const channelIds = product.channels.map((channel) => channel.id);

  assertUniqueIds(funnelIds, 'Funnel ids');
  assertUniqueIds(channelIds, 'Channel ids');

  if (!hasSequentialPositions([...product.funnels].sort((a, b) => a.position - b.position))) {
    throw new AppError(`Invalid funnel positions for product ${product.name}`, 400);
  }

  if (!hasSequentialPositions([...product.channels].sort((a, b) => a.position - b.position))) {
    throw new AppError(`Invalid channel positions for product ${product.name}`, 400);
  }

  for (const funnel of product.funnels) {
    assertNoFunnelCycle(
      product.funnels.map((entry) => ({
        id: entry.id,
        parentFunnelId: entry.parentFunnelId,
      })),
      funnel.id,
      funnel.parentFunnelId,
    );
  }

  for (const category of CATEGORY_VALUES) {
    for (const [funnelId, channelMap] of Object.entries(product.data[category])) {
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

export async function ensureLegacyFunnelParents(db: DbClient, productId?: string) {
  const products = await db.product.findMany({
    where: productId ? { id: productId } : undefined,
    select: {
      id: true,
      funnels: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          parentFunnelId: true,
        },
      },
    },
  });

  const updates = products.flatMap((product) => {
    if (product.funnels.length <= 1 || !product.funnels.every((funnel) => funnel.parentFunnelId === null)) {
      return [];
    }

    return product.funnels.slice(1).map((funnel, index) =>
      db.funnel.update({
        where: { id: funnel.id },
        data: { parentFunnelId: product.funnels[index].id },
      }),
    );
  });

  if (updates.length > 0) {
    await Promise.all(updates);
  }
}

export async function ensureDataIntegrity(db: DbClient, productId?: string) {
  if (!productId) {
    await ensureProductPositions(db);
  }

  await ensureLegacyFunnelParents(db, productId);
}

export async function getProductGraphOrThrow(db: DbClient, productId: string) {
  await ensureLegacyFunnelParents(db, productId);

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
  await ensureProductPositions(db);

  return db.product.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      position: true,
    },
  });
}

export function mapProduct(product: ProductGraph): ProductDto {
  const data = buildEmptyProductData(product);

  for (const row of product.inputValues) {
    data[row.category as CategoryValue][row.funnelId][row.channelId] = {
      visits: row.visits,
      revenue: row.revenue,
    };
  }

  return {
    id: product.id,
    name: product.name,
    position: product.position,
    layout: {
      channelColumnWidth: product.channelColumnWidth,
    },
    funnels: product.funnels.map((funnel) => ({
      id: funnel.id,
      name: funnel.name,
      position: funnel.position,
      parentFunnelId: funnel.parentFunnelId,
      targets: {
        newChannels: funnel.target?.newTargetVisits ?? funnel.target?.targetVisits ?? 0,
        existingChannels: funnel.target?.existingTargetVisits ?? funnel.target?.targetVisits ?? 0,
      },
    })),
    channels: product.channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      position: channel.position,
    })),
    data,
  };
}

export function computeDashboard(products: ProductDto[], globalTargets: GlobalTargetsDto): DashboardResponse {
  const productBreakdown = products.map((product) => {
    let revenue = 0;
    let newVisits = 0;
    let existingVisits = 0;

    for (const funnel of Object.values(product.data.newChannels)) {
      for (const channel of Object.values(funnel)) {
        revenue += channel.revenue;
        newVisits += channel.visits;
      }
    }

    for (const funnel of Object.values(product.data.existingChannels)) {
      for (const channel of Object.values(funnel)) {
        revenue += channel.revenue;
        existingVisits += channel.visits;
      }
    }

    return {
      id: product.id,
      name: product.name,
      revenue,
      newVisits,
      existingVisits,
    };
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
    globalTargets,
    globalActuals,
    productBreakdown,
  };
}

export async function getDashboardPayload(db: DbClient): Promise<DashboardResponse> {
  await ensureDataIntegrity(db);

  const targets = await ensureDashboardTargets(db);
  const products = await db.product.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: productGraphInclude,
  });

  const productDtos = products.map(mapProduct);
  return computeDashboard(productDtos, toGlobalTargetsDto(targets));
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
    globalTargets: toGlobalTargetsDto(targets),
    products: products.map(mapProduct),
  };
}

export function assertName(name: string) {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new AppError('Name is required', 400);
  }

  return trimmed;
}

export async function createProduct(db: DbClient, name: string) {
  const trimmedName = assertName(name);
  const position = await db.product.count();

  const product = await db.product.create({
    data: {
      name: trimmedName,
      position,
      channelColumnWidth: DEFAULT_CHANNEL_COLUMN_WIDTH,
    },
  });

  const funnel = await db.funnel.create({
    data: {
      productId: product.id,
      name: 'Funnel 1',
      position: 0,
      parentFunnelId: null,
    },
  });

  await db.funnelTarget.create({
    data: {
      funnelId: funnel.id,
      targetVisits: 0,
      newTargetVisits: 0,
      existingTargetVisits: 0,
    },
  });

  const channel = await db.channel.create({
    data: {
      productId: product.id,
      name: 'Channel 1',
      position: 0,
    },
  });

  await db.inputValue.createMany({
    data: CATEGORY_VALUES.map((category) => ({
      productId: product.id,
      funnelId: funnel.id,
      channelId: channel.id,
      category: category as Category,
      visits: 0,
      revenue: 0,
    })),
  });

  return getProductGraphOrThrow(db, product.id);
}

export async function addFunnel(db: DbClient, productId: string, name: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      funnels: {
        orderBy: { position: 'asc' },
      },
      channels: {
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  if (product.funnels.length >= MAX_FUNNELS_PER_PRODUCT) {
    throw new AppError(`Products can have at most ${MAX_FUNNELS_PER_PRODUCT} funnels`, 409);
  }

  const funnel = await db.funnel.create({
    data: {
      productId,
      name: assertName(name),
      position: product.funnels.length,
      parentFunnelId: product.funnels.at(-1)?.id ?? null,
    },
  });

  await db.funnelTarget.create({
    data: {
      funnelId: funnel.id,
      targetVisits: 0,
      newTargetVisits: 0,
      existingTargetVisits: 0,
    },
  });

  await db.inputValue.createMany({
    data: product.channels.flatMap((channel) =>
      CATEGORY_VALUES.map((category) => ({
        productId,
        funnelId: funnel.id,
        channelId: channel.id,
        category: category as Category,
        visits: 0,
        revenue: 0,
      })),
    ),
  });

  return getProductGraphOrThrow(db, productId);
}

export async function addChannel(db: DbClient, productId: string, name: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      funnels: {
        orderBy: { position: 'asc' },
      },
      channels: {
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  if (product.channels.length >= MAX_CHANNELS_PER_PRODUCT) {
    throw new AppError(`Products can have at most ${MAX_CHANNELS_PER_PRODUCT} channels`, 409);
  }

  const channel = await db.channel.create({
    data: {
      productId,
      name: assertName(name),
      position: product.channels.length,
    },
  });

  await db.inputValue.createMany({
    data: product.funnels.flatMap((funnel) =>
      CATEGORY_VALUES.map((category) => ({
        productId,
        funnelId: funnel.id,
        channelId: channel.id,
        category: category as Category,
        visits: 0,
        revenue: 0,
      })),
    ),
  });

  return getProductGraphOrThrow(db, productId);
}

export async function compactPositions(
  db: DbClient,
  entity: 'product' | 'funnel' | 'channel',
  productId?: string,
) {
  if (entity === 'product') {
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

    return;
  }

  if (!productId) {
    throw new AppError('Product id is required', 500);
  }

  if (entity === 'funnel') {
    const funnels = await db.funnel.findMany({
      where: { productId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });

    await Promise.all(
      funnels.map((funnel, index) =>
        db.funnel.update({
          where: { id: funnel.id },
          data: { position: index },
        }),
      ),
    );

    return;
  }

  const channels = await db.channel.findMany({
    where: { productId },
    orderBy: { position: 'asc' },
    select: { id: true },
  });

  await Promise.all(
    channels.map((channel, index) =>
      db.channel.update({
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
    'products',
  );

  await Promise.all(
    productIds.map((productId, index) =>
      db.product.update({
        where: { id: productId },
        data: { position: index },
      }),
    ),
  );

  return listProductSummaries(db);
}

export async function reorderFunnels(db: DbClient, productId: string, funnelIds: string[]) {
  const product = await getProductGraphOrThrow(db, productId);
  assertExactIdList(
    funnelIds,
    product.funnels.map((funnel) => funnel.id),
    'funnels',
  );

  await Promise.all(
    funnelIds.map((funnelId, index) =>
      db.funnel.update({
        where: { id: funnelId },
        data: { position: index + 1000 },
      }),
    ),
  );

  await Promise.all(
    funnelIds.map((funnelId, index) =>
      db.funnel.update({
        where: { id: funnelId },
        data: { position: index },
      }),
    ),
  );

  return getProductGraphOrThrow(db, productId);
}

export async function reorderChannels(db: DbClient, productId: string, channelIds: string[]) {
  const product = await getProductGraphOrThrow(db, productId);
  assertExactIdList(
    channelIds,
    product.channels.map((channel) => channel.id),
    'channels',
  );

  await Promise.all(
    channelIds.map((channelId, index) =>
      db.channel.update({
        where: { id: channelId },
        data: { position: index + 1000 },
      }),
    ),
  );

  await Promise.all(
    channelIds.map((channelId, index) =>
      db.channel.update({
        where: { id: channelId },
        data: { position: index },
      }),
    ),
  );

  return getProductGraphOrThrow(db, productId);
}

export async function deleteProductAndCompact(db: DbClient, productId: string) {
  const existing = await db.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError('Product not found', 404);
  }

  await db.product.delete({
    where: { id: productId },
  });

  await compactPositions(db, 'product');
}

export async function deleteFunnel(db: DbClient, productId: string, funnelId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      funnels: {
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  if (product.funnels.length <= 1) {
    throw new AppError('Cannot delete the last remaining funnel', 409);
  }

  const funnel = product.funnels.find((entry) => entry.id === funnelId);
  if (!funnel) {
    throw new AppError('Funnel not found', 404);
  }

  await db.funnel.updateMany({
    where: {
      productId,
      parentFunnelId: funnelId,
    },
    data: {
      parentFunnelId: funnel.parentFunnelId,
    },
  });

  await db.funnel.delete({
    where: { id: funnelId },
  });

  await compactPositions(db, 'funnel', productId);
  return getProductGraphOrThrow(db, productId);
}

export async function deleteChannel(db: DbClient, productId: string, channelId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      channels: {
        orderBy: { position: 'asc' },
      },
    },
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  if (product.channels.length <= 1) {
    throw new AppError('Cannot delete the last remaining channel', 409);
  }

  const channel = product.channels.find((entry) => entry.id === channelId);
  if (!channel) {
    throw new AppError('Channel not found', 404);
  }

  await db.channel.delete({
    where: { id: channelId },
  });

  await compactPositions(db, 'channel', productId);
  return getProductGraphOrThrow(db, productId);
}

export async function updateProductLayout(db: DbClient, productId: string, channelColumnWidth: number) {
  await db.product.update({
    where: { id: productId },
    data: { channelColumnWidth },
  });

  return getProductGraphOrThrow(db, productId);
}

export async function duplicateProduct(db: DbClient, productId: string) {
  await ensureProductPositions(db);

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
      channelColumnWidth: source.channelColumnWidth,
    },
  });

  const funnelIdMap = new Map<string, string>();
  for (const funnel of source.funnels) {
    const createdFunnel = await db.funnel.create({
      data: {
        productId: duplicatedProduct.id,
        name: funnel.name,
        position: funnel.position,
        parentFunnelId: null,
      },
    });

    funnelIdMap.set(funnel.id, createdFunnel.id);

    await db.funnelTarget.create({
      data: {
        funnelId: createdFunnel.id,
        targetVisits: funnel.target?.targetVisits ?? funnel.target?.newTargetVisits ?? 0,
        newTargetVisits: funnel.target?.newTargetVisits ?? funnel.target?.targetVisits ?? 0,
        existingTargetVisits: funnel.target?.existingTargetVisits ?? funnel.target?.targetVisits ?? 0,
      },
    });
  }

  const channelIdMap = new Map<string, string>();
  for (const channel of source.channels) {
    const createdChannel = await db.channel.create({
      data: {
        productId: duplicatedProduct.id,
        name: channel.name,
        position: channel.position,
      },
    });

    channelIdMap.set(channel.id, createdChannel.id);
  }

  await Promise.all(
    source.funnels.map((funnel) =>
      db.funnel.update({
        where: {
          id: funnelIdMap.get(funnel.id)!,
        },
        data: {
          parentFunnelId: funnel.parentFunnelId ? funnelIdMap.get(funnel.parentFunnelId) ?? null : null,
        },
      }),
    ),
  );

  await db.inputValue.createMany({
    data: source.inputValues.map((row) => ({
      productId: duplicatedProduct.id,
      funnelId: funnelIdMap.get(row.funnelId)!,
      channelId: channelIdMap.get(row.channelId)!,
      category: row.category,
      visits: row.visits,
      revenue: row.revenue,
    })),
  });

  return getProductGraphOrThrow(db, duplicatedProduct.id);
}

export async function updateFunnelParent(
  db: DbClient,
  productId: string,
  funnelId: string,
  parentFunnelId: string | null,
) {
  const product = await getProductGraphOrThrow(db, productId);
  const funnel = product.funnels.find((entry) => entry.id === funnelId);

  if (!funnel) {
    throw new AppError('Funnel not found', 404);
  }

  assertNoFunnelCycle(
    product.funnels.map((entry) => ({
      id: entry.id,
      parentFunnelId: entry.parentFunnelId,
    })),
    funnelId,
    parentFunnelId,
  );

  await db.funnel.update({
    where: { id: funnelId },
    data: { parentFunnelId },
  });

  return getProductGraphOrThrow(db, productId);
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

  await db.inputValue.deleteMany();
  await db.funnelTarget.deleteMany();
  await db.channel.deleteMany();
  await db.funnel.deleteMany();
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
        channelColumnWidth: product.layout.channelColumnWidth,
      },
    });

    for (const channel of [...product.channels].sort((a, b) => a.position - b.position)) {
      await db.channel.create({
        data: {
          id: channel.id,
          productId: product.id,
          name: channel.name,
          position: channel.position,
        },
      });
    }

    for (const funnel of [...product.funnels].sort((a, b) => a.position - b.position)) {
      await db.funnel.create({
        data: {
          id: funnel.id,
          productId: product.id,
          name: funnel.name,
          position: funnel.position,
          parentFunnelId: null,
        },
      });

      await db.funnelTarget.create({
        data: {
          funnelId: funnel.id,
          targetVisits: funnel.targets.newChannels,
          newTargetVisits: funnel.targets.newChannels,
          existingTargetVisits: funnel.targets.existingChannels,
        },
      });
    }

    await Promise.all(
      product.funnels.map((funnel) =>
        db.funnel.update({
          where: { id: funnel.id },
          data: {
            parentFunnelId: funnel.parentFunnelId,
          },
        }),
      ),
    );

    const rows = CATEGORY_VALUES.flatMap((category) =>
      product.funnels.flatMap((funnel) =>
        product.channels.map((channel) => {
          const cell = product.data[category][funnel.id]?.[channel.id] ?? {
            visits: 0,
            revenue: 0,
          };

          return {
            productId: product.id,
            funnelId: funnel.id,
            channelId: channel.id,
            category: category as Category,
            visits: cell.visits,
            revenue: cell.revenue,
          };
        }),
      ),
    );

    await db.inputValue.createMany({ data: rows });
  }
}
