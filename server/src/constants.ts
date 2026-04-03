export const CATEGORY_VALUES = ['newChannels', 'existingChannels'] as const;

export type CategoryValue = (typeof CATEGORY_VALUES)[number];

export const MAX_FUNNELS_PER_PRODUCT = 10;
export const MAX_CHANNELS_PER_PRODUCT = 10;
export const DASHBOARD_TARGET_ID = 1;
export const DEFAULT_CHANNEL_COLUMN_WIDTH = 208;
export const MIN_CHANNEL_COLUMN_WIDTH = 180;
export const MAX_CHANNEL_COLUMN_WIDTH = 420;
export const BACKUP_VERSION = 1;
