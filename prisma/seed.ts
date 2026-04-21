import { Prisma, PrismaClient, ProductCategory } from '@prisma/client';
import { DASHBOARD_TARGET_SEED, PRODUCT_SEED } from './seed-data.js';
import { hashPassword } from '../server/src/auth.js';
import { parseDateKey } from '../server/src/periods.js';

const prisma = new PrismaClient();
type SeedCategory = (typeof PRODUCT_SEED)[number]['categories'][keyof (typeof PRODUCT_SEED)[number]['categories']];

async function seedCategory(
  tx: PrismaClient | Prisma.TransactionClient,
  productId: string,
  categoryKey: ProductCategory,
  categoryData: SeedCategory,
) {
  const category = await tx.productCategoryState.create({
    data: {
      productId,
      category: categoryKey,
      channelColumnWidth: categoryData.channelColumnWidth,
    },
  });

  const createdFunnels: Array<{ id: string }> = [];
  for (const [index, funnel] of categoryData.funnels.entries()) {
    const createdFunnel = await tx.productFunnel.create({
      data: {
        categoryStateId: category.id,
        name: funnel.name,
        position: index,
        parentFunnelId:
          funnel.parentIndex === null ? null : createdFunnels[funnel.parentIndex]?.id ?? null,
        targetVisits: funnel.targetVisits,
      },
    });

    createdFunnels.push(createdFunnel);
  }

  const createdChannels: Array<{ id: string }> = [];
  for (const [index, channel] of categoryData.channels.entries()) {
    const createdChannel = await tx.productChannel.create({
      data: {
        categoryStateId: category.id,
        name: channel.name,
        position: index,
      },
    });

    createdChannels.push(createdChannel);
  }

  const rows = Object.entries(categoryData.weeks).flatMap(([weekStart, matrix]) =>
    createdFunnels.flatMap((funnel, funnelIndex) =>
      createdChannels.map((channel, channelIndex) => {
        const cell = matrix[funnelIndex]?.[channelIndex] ?? { visits: 0, revenue: 0 };

        return {
          categoryStateId: category.id,
          funnelId: funnel.id,
          channelId: channel.id,
          weekStartDate: parseDateKey(weekStart),
          visits: cell.visits,
          revenue: cell.revenue,
        };
      }),
    ),
  );

  await tx.weeklyInputValue.createMany({ data: rows });
}

async function main() {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.weeklyInputValue.deleteMany();
  await prisma.productChannel.deleteMany();
  await prisma.productFunnel.deleteMany();
  await prisma.productCategoryState.deleteMany();
  await prisma.product.deleteMany();
  await prisma.legacySharedInputValue.deleteMany();
  await prisma.legacySharedFunnelTarget.deleteMany();
  await prisma.legacySharedChannel.deleteMany();
  await prisma.legacySharedFunnel.deleteMany();
  await prisma.legacySharedProduct.deleteMany();
  await prisma.dashboardTarget.deleteMany();

  await prisma.user.create({
    data: {
      username: 'editor',
      passwordHash: await hashPassword('ChangeMe123!'),
      role: 'editor',
    },
  });

  await prisma.dashboardTarget.create({
    data: {
      id: 1,
      revenueTarget: DASHBOARD_TARGET_SEED.revenue,
      newCustomersTarget: DASHBOARD_TARGET_SEED.newCustomers,
      existingCustomersTarget: DASHBOARD_TARGET_SEED.existingCustomers,
    },
  });

  for (const [index, product] of PRODUCT_SEED.entries()) {
    await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          name: product.name,
          position: index,
        },
      });

      await seedCategory(tx, createdProduct.id, ProductCategory.new, product.categories.new);
      await seedCategory(tx, createdProduct.id, ProductCategory.existing, product.categories.existing);
    });
  }
}

main()
  .catch(async (error) => {
    console.error('Seed failed', error);
    process.exitCode = 1;
    await prisma.$disconnect();
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
