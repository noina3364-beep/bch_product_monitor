import { z } from 'zod';
import {
  BACKUP_VERSION,
  CATEGORY_KEYS,
  MAX_CHANNEL_COLUMN_WIDTH,
  MIN_CHANNEL_COLUMN_WIDTH,
  PERIOD_VIEWS,
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

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date');

export const dateKeySchema = isoDateString;

const cellSchema = z.object({
  visits: nonNegativeInt,
  revenue: nonNegativeInt,
});

export const idParamSchema = z.object({
  productId: z.string().min(1),
  category: z.enum(CATEGORY_KEYS).optional(),
  funnelId: z.string().min(1).optional(),
  channelId: z.string().min(1).optional(),
  weekStartDate: isoDateString.optional(),
});

export const periodQuerySchema = z.object({
  view: z.enum(PERIOD_VIEWS).default('week'),
  referenceDate: isoDateString.default(new Date().toISOString().slice(0, 10)),
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
    targetVisits: nonNegativeInt.optional(),
    parentFunnelId: z.string().min(1).nullable().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.targetVisits !== undefined ||
      value.parentFunnelId !== undefined,
    {
      message: 'At least one field is required',
    },
  );

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
  weekStartDate: isoDateString,
  data: z.record(z.string(), z.record(z.string(), cellSchema)),
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

const backupCategorySchema = z.object({
  id: z.string().min(1),
  key: z.enum(CATEGORY_KEYS),
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
      targetVisits: nonNegativeInt,
    }),
  ),
  channels: z.array(
    z.object({
      id: z.string().min(1),
      name: trimmedName,
      position: z.number().int().min(0),
    }),
  ),
  weeks: z.record(z.string(), z.record(z.string(), z.record(z.string(), cellSchema))),
});

const backupProductSchema = z.object({
  id: z.string().min(1),
  name: trimmedName,
  position: z.number().int().min(0),
  categories: z.object({
    new: backupCategorySchema,
    existing: backupCategorySchema,
  }),
});

export const backupImportSchema = z.object({
  backupVersion: z.literal(BACKUP_VERSION),
  exportedAt: z.string().datetime(),
  periodRules: z.object({
    inputGrain: z.literal('week'),
    weekStartsOn: z.literal('monday'),
    periodOwnership: z.literal('weekStartDate'),
  }),
  globalTargets: z.object({
    revenue: nonNegativeInt,
    newCustomers: nonNegativeInt,
    existingCustomers: nonNegativeInt,
  }),
  products: z.array(backupProductSchema),
});

export const editorLoginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(120),
  password: z.string().min(1, 'Password is required').max(255),
});
