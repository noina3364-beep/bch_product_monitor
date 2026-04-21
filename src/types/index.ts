export type ProductCategoryKey = 'new' | 'existing';
export type UserRole = 'editor' | 'viewer';
export type PeriodView = 'week' | 'mtd' | 'ytd';

export interface PeriodSelection {
  view: PeriodView;
  referenceDate: string;
}

export interface FunnelStage {
  id: string;
  name: string;
  position: number;
  parentFunnelId: string | null;
  targetVisits: number;
}

export interface ChannelData {
  visits: number;
  revenue: number;
}

export interface Channel {
  id: string;
  name: string;
  position: number;
}

export interface ProductLayout {
  channelColumnWidth: number;
}

export interface ProductWeekData {
  [funnelId: string]: {
    [channelId: string]: ChannelData;
  };
}

export interface ProductCategoryState {
  id: string;
  key: ProductCategoryKey;
  layout: ProductLayout;
  funnels: FunnelStage[];
  channels: Channel[];
  weeks: Record<string, ProductWeekData>;
}

export interface Product {
  id: string;
  name: string;
  position: number;
  categories: Record<ProductCategoryKey, ProductCategoryState>;
}

export interface GlobalTargets {
  revenue: number;
  newCustomers: number;
  existingCustomers: number;
}

export interface BackupPayload {
  backupVersion: number;
  exportedAt: string;
  periodRules: {
    inputGrain: 'week';
    weekStartsOn: 'monday';
    periodOwnership: 'weekStartDate';
  };
  globalTargets: GlobalTargets;
  products: Product[];
}

export interface AuthSession {
  authenticated: boolean;
  role: UserRole | null;
  username: string | null;
}
