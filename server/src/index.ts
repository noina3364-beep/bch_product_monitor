import express, { type NextFunction, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from './config.js';
import { prisma } from './prisma.js';
import {
  authMiddleware,
  createEditorSession,
  createViewerSession,
  destroySession,
  getRequestAuth,
  requireAuthenticated,
  requireEditor,
  toAuthSessionDto,
  verifyPassword,
} from './auth.js';
import { type CategoryKey, type PeriodView } from './constants.js';
import {
  addChannel,
  addFunnel,
  createProduct,
  deleteChannel,
  deleteFunnel,
  deleteProductAndCompact,
  duplicateProduct,
  ensureDashboardTargets,
  getBackupPayload,
  getDashboardPayload,
  getProductGraphOrThrow,
  listProductSummaries,
  mapProduct,
  reorderChannels,
  reorderFunnels,
  reorderProducts,
  restoreBackup,
  toGlobalTargetsDto,
  updateFunnelParent,
  updateProductLayout,
} from './data_v2.js';
import { AppError } from './errors.js';
import { formatDateKey, parseDateKey } from './periods.js';
import type { BackupPayload } from './types.js';
import {
  backupImportSchema,
  bulkInputValuesSchema,
  createChannelSchema,
  createFunnelSchema,
  createProductSchema,
  dateKeySchema,
  editorLoginSchema,
  idParamSchema,
  periodQuerySchema,
  reorderChannelsSchema,
  reorderFunnelsSchema,
  reorderProductsSchema,
  updateChannelSchema,
  updateDashboardTargetsSchema,
  updateFunnelSchema,
  updateInputValueSchema,
  updateProductLayoutSchema,
  updateProductSchema,
} from './validators.js';

const app = express();
app.locals.prisma = prisma;
const allowedOrigins = Array.from(
  new Set([env.CLIENT_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000']),
);

function isPrivateIpv4(hostname: string) {
  const match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return false;
  }

  const [first, second] = [Number(match[1]), Number(match[2])];
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isAllowedOrigin(origin: string) {
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    if (isPrivateIpv4(hostname)) {
      return true;
    }

    if (!hostname.includes('.')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function getMappedProductCategory(product: ReturnType<typeof mapProduct>, category: CategoryKey) {
  return product.categories[category];
}

app.use((request, response, next) => {
  const origin = request.headers.origin;

  if (origin && isAllowedOrigin(origin)) {
    response.header('Access-Control-Allow-Origin', origin);
    response.header('Vary', 'Origin');
    response.header('Access-Control-Allow-Credentials', 'true');
  }

  response.header('Access-Control-Allow-Headers', 'Content-Type');
  response.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');

  if (request.method === 'OPTIONS') {
    response.status(204).send();
    return;
  }

  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(authMiddleware);

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

app.get('/api/auth/session', (request, response) => {
  response.json(toAuthSessionDto(getRequestAuth(request)));
});

app.post('/api/auth/login/editor', async (request, response, next) => {
  try {
    const body = editorLoginSchema.parse(request.body);
    const existingSessionId = getRequestAuth(request)?.sessionId ?? null;

    if (existingSessionId) {
      await destroySession(prisma, existingSessionId, response);
    }

    const user = await prisma.user.findUnique({
      where: { username: body.username.trim() },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        role: true,
      },
    });

    if (!user || user.role !== 'editor') {
      throw new AppError('Invalid username or password', 401);
    }

    const isValid = await verifyPassword(body.password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid username or password', 401);
    }

    const session = await createEditorSession(prisma, user.id, user.username, response);
    response.json(session);
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login/viewer', async (request, response, next) => {
  try {
    const existingSessionId = getRequestAuth(request)?.sessionId ?? null;

    if (existingSessionId) {
      await destroySession(prisma, existingSessionId, response);
    }

    const session = await createViewerSession(prisma, response);
    response.json(session);
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', async (request, response, next) => {
  try {
    await destroySession(prisma, getRequestAuth(request)?.sessionId ?? null, response);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get('/api/dashboard', requireAuthenticated, async (request, response, next) => {
  try {
    const query = periodQuerySchema.parse(request.query);
    const payload = await getDashboardPayload(prisma, query.view as PeriodView, query.referenceDate);
    response.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get('/api/targets/dashboard', requireAuthenticated, async (_request, response, next) => {
  try {
    const targets = await ensureDashboardTargets(prisma);
    response.json({
      globalTargets: toGlobalTargetsDto(targets),
    });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/targets/dashboard', requireEditor, async (request, response, next) => {
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

app.get('/api/products', requireAuthenticated, async (_request, response, next) => {
  try {
    const products = await listProductSummaries(prisma);
    response.json({ products });
  } catch (error) {
    next(error);
  }
});

app.post('/api/products', requireEditor, async (request, response, next) => {
  try {
    const body = createProductSchema.parse(request.body);
    const product = await prisma.$transaction((tx) => createProduct(tx, body.name));
    response.status(201).json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/products/reorder', requireEditor, async (request, response, next) => {
  try {
    const body = reorderProductsSchema.parse(request.body);
    const products = await prisma.$transaction((tx) => reorderProducts(tx, body.productIds));
    response.json({ products });
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:productId/dashboard', requireAuthenticated, async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const product = await getProductGraphOrThrow(prisma, params.productId);
    response.json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/products/:productId', requireEditor, async (request, response, next) => {
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

app.delete('/api/products/:productId', requireEditor, async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    await prisma.$transaction((tx) => deleteProductAndCompact(tx, params.productId));
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post('/api/products/:productId/duplicate', requireEditor, async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const product = await prisma.$transaction((tx) => duplicateProduct(tx, params.productId));
    response.status(201).json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/products/:productId/categories/:category/layout', requireEditor, async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const body = updateProductLayoutSchema.parse(request.body);
    const product = await prisma.$transaction((tx) =>
      updateProductLayout(tx, params.productId, params.category!, body.channelColumnWidth),
    );
    response.json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:productId/categories/:category/funnels', requireAuthenticated, async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const product = mapProduct(await getProductGraphOrThrow(prisma, params.productId));
    response.json({
      funnels: getMappedProductCategory(product, params.category!).funnels,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/products/:productId/categories/:category/funnels', requireEditor, async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const body = createFunnelSchema.parse(request.body);
    const product = await prisma.$transaction((tx) =>
      addFunnel(tx, params.productId, params.category!, body.name),
    );
    response.status(201).json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/products/:productId/categories/:category/funnels/reorder', requireEditor, async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const body = reorderFunnelsSchema.parse(request.body);
    const product = await prisma.$transaction((tx) =>
      reorderFunnels(tx, params.productId, params.category!, body.funnelIds),
    );
    response.json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/products/:productId/categories/:category/funnels/:funnelId', requireEditor, async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const body = updateFunnelSchema.parse(request.body);

    const product = await prisma.$transaction(async (tx) => {
      const graph = await getProductGraphOrThrow(tx, params.productId);
      const category = graph.categories.find((entry) => entry.category === params.category);
      const existing = category?.funnels.find((funnel) => funnel.id === params.funnelId);

      if (!existing) {
        throw new AppError('Funnel not found', 404);
      }

      if (body.name) {
        await tx.productFunnel.update({
          where: { id: params.funnelId! },
          data: { name: body.name },
        });
      }

      if (body.parentFunnelId !== undefined) {
        await updateFunnelParent(
          tx,
          params.productId,
          params.category!,
          params.funnelId!,
          body.parentFunnelId ?? null,
        );
      }

      if (body.targetVisits !== undefined) {
        await tx.productFunnel.update({
          where: { id: params.funnelId! },
          data: { targetVisits: body.targetVisits },
        });
      }

      return getProductGraphOrThrow(tx, params.productId);
    });

    response.json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/products/:productId/categories/:category/funnels/:funnelId', requireEditor, async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const product = await prisma.$transaction((tx) =>
      deleteFunnel(tx, params.productId, params.category!, params.funnelId!),
    );
    response.json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:productId/categories/:category/channels', requireAuthenticated, async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const product = mapProduct(await getProductGraphOrThrow(prisma, params.productId));
    response.json({
      channels: getMappedProductCategory(product, params.category!).channels,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/products/:productId/categories/:category/channels', requireEditor, async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const body = createChannelSchema.parse(request.body);
    const product = await prisma.$transaction((tx) =>
      addChannel(tx, params.productId, params.category!, body.name),
    );
    response.status(201).json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/products/:productId/categories/:category/channels/reorder', requireEditor, async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const body = reorderChannelsSchema.parse(request.body);
    const product = await prisma.$transaction((tx) =>
      reorderChannels(tx, params.productId, params.category!, body.channelIds),
    );
    response.json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/products/:productId/categories/:category/channels/:channelId', requireEditor, async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const body = updateChannelSchema.parse(request.body);

    const categoryState = (await getProductGraphOrThrow(prisma, params.productId)).categories.find(
      (entry) => entry.category === params.category,
    );

    const channel = categoryState?.channels.find((entry) => entry.id === params.channelId);
    if (!channel) {
      throw new AppError('Channel not found', 404);
    }

    await prisma.productChannel.update({
      where: { id: params.channelId },
      data: { name: body.name },
    });

    const product = await getProductGraphOrThrow(prisma, params.productId);
    response.json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/products/:productId/categories/:category/channels/:channelId', requireEditor, async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const product = await prisma.$transaction((tx) =>
      deleteChannel(tx, params.productId, params.category!, params.channelId!),
    );
    response.json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:productId/categories/:category/input-values', requireAuthenticated, async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const categoryState = (await getProductGraphOrThrow(prisma, params.productId)).categories.find(
      (entry) => entry.category === params.category,
    );

    if (!categoryState) {
      throw new AppError('Category not found', 404);
    }

    const weekStartDate =
      typeof request.query.weekStartDate === 'string'
        ? dateKeySchema.parse(request.query.weekStartDate)
        : undefined;

    const inputValues = await prisma.weeklyInputValue.findMany({
      where: {
        categoryStateId: categoryState.id,
        ...(weekStartDate ? { weekStartDate: parseDateKey(weekStartDate) } : {}),
      },
      orderBy: [
        { weekStartDate: 'asc' },
        { funnel: { position: 'asc' } },
        { channel: { position: 'asc' } },
      ],
      select: {
        id: true,
        categoryStateId: true,
        funnelId: true,
        channelId: true,
        weekStartDate: true,
        visits: true,
        revenue: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    response.json({
      inputValues: inputValues.map((row) => ({
        ...row,
        weekStartDate: row.weekStartDate.toISOString().slice(0, 10),
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.patch(
  '/api/products/:productId/categories/:category/input-values/:weekStartDate/:funnelId/:channelId',
  requireEditor,
  async (request, response, next) => {
    try {
      const params = idParamSchema.parse(request.params);
      const body = updateInputValueSchema.parse(request.body);

      const productGraph = await getProductGraphOrThrow(prisma, params.productId);
      const categoryState = productGraph.categories.find((entry) => entry.category === params.category);

      if (!categoryState) {
        throw new AppError('Category not found', 404);
      }

      const funnelExists = categoryState.funnels.some((funnel) => funnel.id === params.funnelId);
      const channelExists = categoryState.channels.some((channel) => channel.id === params.channelId);

      if (!funnelExists) {
        throw new AppError('Funnel not found', 404);
      }

      if (!channelExists) {
        throw new AppError('Channel not found', 404);
      }

      const existing = categoryState.weeklyInputs.find(
        (row) =>
          row.funnelId === params.funnelId &&
          row.channelId === params.channelId &&
          formatDateKey(row.weekStartDate) === params.weekStartDate,
      );

      await prisma.weeklyInputValue.upsert({
        where: {
          categoryStateId_funnelId_channelId_weekStartDate: {
            categoryStateId: categoryState.id,
            funnelId: params.funnelId!,
            channelId: params.channelId!,
            weekStartDate: parseDateKey(params.weekStartDate!),
          },
        },
        create: {
          categoryStateId: categoryState.id,
          funnelId: params.funnelId!,
          channelId: params.channelId!,
          weekStartDate: parseDateKey(params.weekStartDate!),
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

app.put('/api/products/:productId/categories/:category/input-values/bulk', requireEditor, async (request, response, next) => {
  try {
    const params = idParamSchema.parse(request.params);
    const body = bulkInputValuesSchema.parse(request.body);

    const product = await prisma.$transaction(async (tx) => {
      const productGraph = await getProductGraphOrThrow(tx, params.productId);
      const categoryState = productGraph.categories.find((entry) => entry.category === params.category);

      if (!categoryState) {
        throw new AppError('Category not found', 404);
      }

      const funnelIds = new Set(categoryState.funnels.map((funnel) => funnel.id));
      const channelIds = new Set(categoryState.channels.map((channel) => channel.id));
      const upserts = [];

      for (const [funnelId, channelMap] of Object.entries(body.data)) {
        if (!funnelIds.has(funnelId)) {
          throw new AppError(`Unknown funnel: ${funnelId}`, 400);
        }

        for (const [channelId, cell] of Object.entries(channelMap)) {
          if (!channelIds.has(channelId)) {
            throw new AppError(`Unknown channel: ${channelId}`, 400);
          }

          upserts.push(
            tx.weeklyInputValue.upsert({
              where: {
                categoryStateId_funnelId_channelId_weekStartDate: {
                  categoryStateId: categoryState.id,
                  funnelId,
                  channelId,
                  weekStartDate: parseDateKey(body.weekStartDate),
                },
              },
              create: {
                categoryStateId: categoryState.id,
                funnelId,
                channelId,
                weekStartDate: parseDateKey(body.weekStartDate),
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

      await Promise.all(upserts);
      return getProductGraphOrThrow(tx, params.productId);
    });

    response.json({ product: mapProduct(product) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/backup/export', requireEditor, async (_request, response, next) => {
  try {
    const backup = await getBackupPayload(prisma);
    response.json(backup);
  } catch (error) {
    next(error);
  }
});

app.post('/api/backup/import', requireEditor, async (request, response, next) => {
  try {
    const body = backupImportSchema.parse(request.body) as BackupPayload;
    await prisma.$transaction((tx) => restoreBackup(tx, body));

    const [products, targets] = await Promise.all([
      Promise.all(
        (await listProductSummaries(prisma)).map(async (product) =>
          mapProduct(await getProductGraphOrThrow(prisma, product.id)),
        ),
      ),
      ensureDashboardTargets(prisma),
    ]);

    response.json({
      products,
      globalTargets: toGlobalTargetsDto(targets),
    });
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
