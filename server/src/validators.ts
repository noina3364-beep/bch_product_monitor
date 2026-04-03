import { z } from 'zod';
import {
  BACKUP_VERSION,
  CATEGORY_VALUES,
  MAX_CHANNEL_COLUMN_WIDTH,
  MIN_CHANNEL_COLUMN_WIDTH,
} from './constants.js';

const trimmedName = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(120, 'Name must be 120 characters or fewer');

const nonNegativeInt = z
  .number({ error: 'Expected a number' })
  .int('Expected an integer')
  .min(0, 'Expected a non-negative integer');

const cellSchema = z.object({
  visits: nonNegativeInt,
  revenue: nonNegativeInt,
});

export const idParamSchema = z.object({
  productId: z.string().min(1),
  funnelId: z.string().min(1).optional(),
  channelId: z.string().min(1).optional(),
  category: z.enum(CATEGORY_VALUES).optional(),
});

export const createProductSchema = z.object({
  name: trimmedName,
});

export const updateProductSchema = z.object({
  name: trimmedName,
});

export const createFunnelSchema = z.object({
  name: trimmedName,
});

export const updateFunnelSchema = z
  .object({
    name: trimmedName.optional(),
    category: z.enum(CATEGORY_VALUES).optional(),
    target: nonNegativeInt.optional(),
    parentFunnelId: z.string().min(1).nullable().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined || value.target !== undefined || value.parentFunnelId !== undefined,
    {
    message: 'At least one field is required',
    },
  )
  .refine((value) => value.target === undefined || value.category !== undefined, {
    message: 'Category is required when updating a target',
    path: ['category'],
  });

export const createChannelSchema = z.object({
  name: trimmedName,
});

export const updateChannelSchema = z.object({
  name: trimmedName,
});

export const updateDashboardTargetsSchema = z
  .object({
    revenue: nonNegativeInt.optional(),
    newCustomers: nonNegativeInt.optional(),
    existingCustomers: nonNegativeInt.optional(),
  })
  .refine(
    (value) =>
      value.revenue !== undefined ||
      value.newCustomers !== undefined ||
      value.existingCustomers !== undefined,
    {
      message: 'At least one target is required',
    },
  );

export const updateInputValueSchema = z
  .object({
    visits: nonNegativeInt.optional(),
    revenue: nonNegativeInt.optional(),
  })
  .refine((value) => value.visits !== undefined || value.revenue !== undefined, {
    message: 'At least one field is required',
  });

export const bulkInputValuesSchema = z.object({
  data: z
    .object({
      newChannels: z.record(z.string(), z.record(z.string(), cellSchema)).optional(),
      existingChannels: z.record(z.string(), z.record(z.string(), cellSchema)).optional(),
    })
    .refine(
      (value) => value.newChannels !== undefined || value.existingChannels !== undefined,
      { message: 'At least one category is required' },
    ),
});

export const reorderProductsSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1),
});

export const reorderFunnelsSchema = z.object({
  funnelIds: z.array(z.string().min(1)).min(1),
});

export const reorderChannelsSchema = z.object({
  channelIds: z.array(z.string().min(1)).min(1),
});

export const updateProductLayoutSchema = z.object({
  channelColumnWidth: z
    .number({ error: 'Expected a number' })
    .int('Expected an integer')
    .min(MIN_CHANNEL_COLUMN_WIDTH)
    .max(MAX_CHANNEL_COLUMN_WIDTH),
});

const backupCellSchema = z.object({
  visits: nonNegativeInt,
  revenue: nonNegativeInt,
});

const backupProductSchema = z.object({
  id: z.string().min(1),
  name: trimmedName,
  position: z.number().int().min(0),
  layout: z.object({
    channelColumnWidth: z
      .number({ error: 'Expected a number' })
      .int('Expected an integer')
      .min(MIN_CHANNEL_COLUMN_WIDTH)
      .max(MAX_CHANNEL_COLUMN_WIDTH),
  }),
  funnels: z.array(
    z.object({
      id: z.string().min(1),
      name: trimmedName,
      position: z.number().int().min(0),
      parentFunnelId: z.string().min(1).nullable(),
      targets: z.object({
        newChannels: nonNegativeInt,
        existingChannels: nonNegativeInt,
      }),
    }),
  ),
  channels: z.array(
    z.object({
      id: z.string().min(1),
      name: trimmedName,
      position: z.number().int().min(0),
    }),
  ),
  data: z.object({
    newChannels: z.record(z.string(), z.record(z.string(), backupCellSchema)),
    existingChannels: z.record(z.string(), z.record(z.string(), backupCellSchema)),
  }),
});

export const backupImportSchema = z.object({
  backupVersion: z.literal(BACKUP_VERSION),
  exportedAt: z.string().datetime(),
  globalTargets: z.object({
    revenue: nonNegativeInt,
    newCustomers: nonNegativeInt,
    existingCustomers: nonNegativeInt,
  }),
  products: z.array(backupProductSchema),
});
