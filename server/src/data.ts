import { Prisma, type Category, type PrismaClient } from '@prisma/client';
import {
  CATEGORY_VALUES,
  DASHBOARD_TARGET_ID,
  MAX_CHANNELS_PER_PRODUCT,
  MAX_FUNNELS_PER_PRODUCT,
  type CategoryValue,
} from './constants.js';
import { AppError } from './errors.js';
import type { DashboardResponse, GlobalTargetsDto, ProductDto } from './types.js';

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
    orderBy: [
      { category: 'asc' },
      { funnel: { position: 'asc' } },
      { channel: { position: 'asc' } },
    ],
  },
});

type ProductGraph = Prisma.ProductGetPayload<{
  include: typeof productGraphInclude;
}>;

type DbClient = PrismaClient | Prisma.TransactionClient;

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

export async function getProductGraphOrThrow(db: DbClient, productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: productGraphInclude,
  });

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  return product;
}

export function mapProduct(product: ProductGraph): ProductDto {
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

  for (const row of product.inputValues) {
    data[row.category as CategoryValue][row.funnelId][row.channelId] = {
      visits: row.visits,
      revenue: row.revenue,
    };
  }

  return {
    id: product.id,
    name: product.name,
    funnels: product.funnels.map((funnel) => ({
      id: funnel.id,
      name: funnel.name,
      targets: {
        newChannels: funnel.target?.newTargetVisits ?? funnel.target?.targetVisits ?? 0,
        existingChannels:
          funnel.target?.existingTargetVisits ?? funnel.target?.targetVisits ?? 0,
      },
    })),
    channels: product.channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
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
  const targets = await ensureDashboardTargets(db);
  const products = await db.product.findMany({
    orderBy: { createdAt: 'asc' },
    include: productGraphInclude,
  });

  const productDtos = products.map(mapProduct);
  return computeDashboard(productDtos, toGlobalTargetsDto(targets));
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

  const product = await db.product.create({
    data: {
      name: trimmedName,
    },
  });

  const funnel = await db.funnel.create({
    data: {
      productId: product.id,
      name: 'Funnel 1',
      position: 0,
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
  entity: 'funnel' | 'channel',
  productId: string,
) {
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
