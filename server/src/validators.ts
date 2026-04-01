import { z } from 'zod';
import { CATEGORY_VALUES } from './constants.js';

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
    target: nonNegativeInt.optional(),
  })
  .refine((value) => value.name !== undefined || value.target !== undefined, {
    message: 'At least one field is required',
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
