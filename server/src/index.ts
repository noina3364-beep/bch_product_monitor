import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from './config.js';
import { prisma } from './prisma.js';
import { AppError } from './errors.js';
import {
  addChannel,
  addFunnel,
  createProduct,
  deleteChannel,
  deleteFunnel,
  ensureDashboardTargets,
  getDashboardPayload,
  getProductGraphOrThrow,
  mapProduct,
  toGlobalTargetsDto,
} from './data.js';
import {
  bulkInputValuesSchema,
  createChannelSchema,
  createFunnelSchema,
  createProductSchema,
  idParamSchema,
  updateChannelSchema,
  updateDashboardTargetsSchema,
  updateFunnelSchema,
  updateInputValueSchema,
  updateProductSchema,
} from './validators.js';

const app = express();
const allowedOrigins = Array.from(
  new Set([env.CLIENT_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000']),
);

app.use(
  cors({
    origin: allowedOrigins,
  }),
);
app.use(express.json());

app.get('/api/health', async (_request, response, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    response.json({
      status: 'ok',
      database: 'ok',
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/dashboard', async (_request, response, next) => {
  try {
    const payload = await getDashboardPayload(prisma);
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get('/api/targets/dashboard', async (_request, response, next) => {
  try {
    const targets = await ensureDashboardTargets(prisma);
    response.json({
      globalTargets: toGlobalTargetsDto(targets),
    });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/targets/dashboard', async (request, response, next) => {
  try {
    const body = updateDashboardTargetsSchema.parse(request.body);
    const existing = await ensureDashboardTargets(prisma);

    const targets = await prisma.dashboardTarget.update({
      where: { id: existing.id },
      data: {
        revenueTarget: body.revenue ?? existing.revenueTarget,
        newCustomersTarget: body.newCustomers ?? existing.newCustomersTarget,
        existingCustomersTarget: body.existingCustomers ?? existing.existingCustomersTarget,
      },
    });

    response.json({
      globalTargets: toGlobalTargetsDto(targets),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/products', async (_request, response, next) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
      },
    });

    response.json({ products });
  } catch (error) {
    next(error);
  }
});

app.post('/api/products', async (request, response, next) => {
  try {
    const body = createProductSchema.parse(request.body);
    const product = await prisma.$transaction((tx) => createProduct(tx, body.name));
    response.status(201).json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:productId/dashboard', async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const product = await getProductGraphOrThrow(prisma, params.productId);
    response.json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/products/:productId', async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const body = updateProductSchema.parse(request.body);

    await prisma.product.update({
      where: { id: params.productId },
      data: { name: body.name },
    });

    const product = await getProductGraphOrThrow(prisma, params.productId);
    response.json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/products/:productId', async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);

    const existing = await prisma.product.findUnique({
      where: { id: params.productId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Product not found', 404);
    }

    await prisma.product.delete({
      where: { id: params.productId },
    });

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:productId/funnels', async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const product = await getProductGraphOrThrow(prisma, params.productId);
    response.json({
      funnels: mapProduct(product).funnels,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/products/:productId/funnels', async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const body = createFunnelSchema.parse(request.body);
    const product = await prisma.$transaction((tx) => addFunnel(tx, params.productId, body.name));
    response.status(201).json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/products/:productId/funnels/:funnelId', async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const body = updateFunnelSchema.parse(request.body);

    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.funnel.findFirst({
        where: {
          id: params.funnelId,
          productId: params.productId,
        },
        select: {
          id: true,
          target: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!existing) {
        throw new AppError('Funnel not found', 404);
      }

      if (body.name) {
        await tx.funnel.update({
          where: { id: params.funnelId },
          data: { name: body.name },
        });
      }

      if (body.target !== undefined) {
        if (existing.target) {
          await tx.funnelTarget.update({
            where: { funnelId: params.funnelId },
            data: { targetVisits: body.target },
          });
        } else {
          await tx.funnelTarget.create({
            data: {
              funnelId: params.funnelId!,
              targetVisits: body.target,
            },
          });
        }
      }

      return getProductGraphOrThrow(tx, params.productId);
    });

    response.json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/products/:productId/funnels/:funnelId', async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const product = await prisma.$transaction((tx) => deleteFunnel(tx, params.productId, params.funnelId!));
    response.json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:productId/channels', async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const product = await getProductGraphOrThrow(prisma, params.productId);
    response.json({
      channels: mapProduct(product).channels,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/products/:productId/channels', async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const body = createChannelSchema.parse(request.body);
    const product = await prisma.$transaction((tx) => addChannel(tx, params.productId, body.name));
    response.status(201).json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/products/:productId/channels/:channelId', async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const body = updateChannelSchema.parse(request.body);

    const channel = await prisma.channel.findFirst({
      where: {
        id: params.channelId,
        productId: params.productId,
      },
      select: { id: true },
    });

    if (!channel) {
      throw new AppError('Channel not found', 404);
    }

    await prisma.channel.update({
      where: { id: params.channelId },
      data: { name: body.name },
    });

    const product = await getProductGraphOrThrow(prisma, params.productId);
    response.json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/products/:productId/channels/:channelId', async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const product = await prisma.$transaction((tx) => deleteChannel(tx, params.productId, params.channelId!));
    response.json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:productId/input-values', async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const product = await prisma.product.findUnique({
      where: { id: params.productId },
      select: { id: true },
    });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    const category = request.query.category;
    const parsedCategory =
      typeof category === 'string'
        ? idParamSchema.parse({ category }).category
        : undefined;

    const inputValues = await prisma.inputValue.findMany({
      where: {
        productId: params.productId,
        category: parsedCategory,
      },
      orderBy: [
        { category: 'asc' },
        { funnel: { position: 'asc' } },
        { channel: { position: 'asc' } },
      ],
      select: {
        id: true,
        productId: true,
        funnelId: true,
        channelId: true,
        category: true,
        visits: true,
        revenue: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    response.json({ inputValues });
  } catch (error) {
    next(error);
  }
});

app.patch(
  '/api/products/:productId/input-values/:category/:funnelId/:channelId',
  async (request, response, next) => {
    try {
      const params = idParamSchema.parse(request.params);
      const body = updateInputValueSchema.parse(request.body);

      const productGraph = await getProductGraphOrThrow(prisma, params.productId);
      const funnelExists = productGraph.funnels.some((funnel) => funnel.id === params.funnelId);
      const channelExists = productGraph.channels.some((channel) => channel.id === params.channelId);

      if (!funnelExists) {
        throw new AppError('Funnel not found', 404);
      }

      if (!channelExists) {
        throw new AppError('Channel not found', 404);
      }

      const existing = productGraph.inputValues.find(
        (row) =>
          row.category === params.category &&
          row.funnelId === params.funnelId &&
          row.channelId === params.channelId,
      );

      await prisma.inputValue.upsert({
        where: {
          productId_category_funnelId_channelId: {
            productId: params.productId,
            category: params.category!,
            funnelId: params.funnelId!,
            channelId: params.channelId!,
          },
        },
        create: {
          productId: params.productId,
          category: params.category!,
          funnelId: params.funnelId!,
          channelId: params.channelId!,
          visits: body.visits ?? existing?.visits ?? 0,
          revenue: body.revenue ?? existing?.revenue ?? 0,
        },
        update: {
          ...(body.visits !== undefined ? { visits: body.visits } : {}),
          ...(body.revenue !== undefined ? { revenue: body.revenue } : {}),
        },
      });

      const product = await getProductGraphOrThrow(prisma, params.productId);
      response.json({ product: mapProduct(product) });
    } catch (error) {
      next(error);
    }
  },
);

app.put('/api/products/:productId/input-values/bulk', async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const body = bulkInputValuesSchema.parse(request.body);

    const product = await prisma.$transaction(async (tx) => {
      const productGraph = await getProductGraphOrThrow(tx, params.productId);
      const funnelIds = new Set(productGraph.funnels.map((funnel) => funnel.id));
      const channelIds = new Set(productGraph.channels.map((channel) => channel.id));
      const upserts = [];

      for (const [category, funnelMap] of Object.entries(body.data)) {
        if (!funnelMap) {
          continue;
        }

        for (const [funnelId, channelMap] of Object.entries(funnelMap)) {
          if (!funnelIds.has(funnelId)) {
            throw new AppError(`Unknown funnel: ${funnelId}`, 400);
          }

          for (const [channelId, cell] of Object.entries(channelMap)) {
            if (!channelIds.has(channelId)) {
              throw new AppError(`Unknown channel: ${channelId}`, 400);
            }

            upserts.push(
              tx.inputValue.upsert({
                where: {
                  productId_category_funnelId_channelId: {
                    productId: params.productId,
                    category: category as 'newChannels' | 'existingChannels',
                    funnelId,
                    channelId,
                  },
                },
                create: {
                  productId: params.productId,
                  category: category as 'newChannels' | 'existingChannels',
                  funnelId,
                  channelId,
                  visits: cell.visits,
                  revenue: cell.revenue,
                },
                update: {
                  visits: cell.visits,
                  revenue: cell.revenue,
                },
              }),
            );
          }
        }
      }

      await Promise.all(upserts);
      return getProductGraphOrThrow(tx, params.productId);
    });

    response.json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: 'Invalid request',
      details: error.issues,
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: error.message,
      details: error.details,
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    response.status(404).json({
      error: 'Resource not found',
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: 'Internal server error',
  });
});

app.listen(env.PORT, () => {
  console.log(`BCH Product Monitor API listening on http://localhost:${env.PORT}`);
});
