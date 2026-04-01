export const CATEGORY_VALUES = ['newChannels', 'existingChannels'] as const;

export type CategoryValue = (typeof CATEGORY_VALUES)[number];

export const MAX_FUNNELS_PER_PRODUCT = 10;
export const MAX_CHANNELS_PER_PRODUCT = 10;
export const DASHBOARD_TARGET_ID = 1;
