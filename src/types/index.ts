export type CategoryType = 'newChannels' | 'existingChannels';

export interface FunnelTargets {
  newChannels: number;
  existingChannels: number;
}

export interface FunnelStage {
  id: string;
  name: string;
  position: number;
  parentFunnelId: string | null;
  targets: FunnelTargets;
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

export interface ProductData {
  [funnelId: string]: {
    [channelId: string]: ChannelData;
  };
}

export interface Product {
  id: string;
  name: string;
  position: number;
  funnels: FunnelStage[];
  channels: Channel[]; // Shared structure for both New and Existing
  layout: ProductLayout;
  data: {
    newChannels: ProductData;
    existingChannels: ProductData;
  };
}

export interface GlobalTargets {
  revenue: number;
  newCustomers: number;
  existingCustomers: number;
}

export interface BackupPayload {
  backupVersion: number;
  exportedAt: string;
  globalTargets: GlobalTargets;
  products: Product[];
}
