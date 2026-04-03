import { PrismaClient, type Category } from '@prisma/client';
import { DASHBOARD_TARGET_SEED, PRODUCT_SEED } from './seed-data.js';

const prisma = new PrismaClient();

const categories: Category[] = ['newChannels', 'existingChannels'];

async function main() {
  await prisma.inputValue.deleteMany();
  await prisma.funnelTarget.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.funnel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.dashboardTarget.deleteMany();

  await prisma.dashboardTarget.create({
    data: {
      id: 1,
      revenueTarget: DASHBOARD_TARGET_SEED.revenue,
      newCustomersTarget: DASHBOARD_TARGET_SEED.newCustomers,
      existingCustomersTarget: DASHBOARD_TARGET_SEED.existingCustomers,
    },
  });

  for (const product of PRODUCT_SEED) {
    await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: { name: product.name },
      });

      const createdFunnels: Array<{ id: string }> = [];
      for (const [index, funnel] of product.funnels.entries()) {
        const createdFunnel = await tx.funnel.create({
          data: {
            productId: createdProduct.id,
            name: funnel.name,
            position: index,
          },
        });

        await tx.funnelTarget.create({
          data: {
            funnelId: createdFunnel.id,
            targetVisits: funnel.targets.newChannels,
            newTargetVisits: funnel.targets.newChannels,
            existingTargetVisits: funnel.targets.existingChannels,
          },
        });

        createdFunnels.push(createdFunnel);
      }

      const createdChannels: Array<{ id: string }> = [];
      for (const [index, channel] of product.channels.entries()) {
        const createdChannel = await tx.channel.create({
          data: {
            productId: createdProduct.id,
            name: channel.name,
            position: index,
          },
        });

        createdChannels.push(createdChannel);
      }

      const rows = categories.flatMap((category) => {
        const matrix = product.data[category];

        return createdFunnels.flatMap((funnel, funnelIndex) =>
          createdChannels.map((channel, channelIndex) => {
            const cell = matrix[funnelIndex]?.[channelIndex] ?? { visits: 0, revenue: 0 };

            return {
              productId: createdProduct.id,
              funnelId: funnel.id,
              channelId: channel.id,
              category,
              visits: cell.visits,
              revenue: cell.revenue,
            };
          }),
        );
      });

      await tx.inputValue.createMany({ data: rows });
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
