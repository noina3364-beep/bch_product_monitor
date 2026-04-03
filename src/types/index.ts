export type CategoryType = 'newChannels' | 'existingChannels';

export interface FunnelTargets {
  newChannels: number;
  existingChannels: number;
}

export interface FunnelStage {
  id: string;
  name: string;
  targets: FunnelTargets;
}

export interface ChannelData {
  visits: number;
  revenue: number;
}

export interface Channel {
  id: string;
  name: string;
}

export interface ProductData {
  [funnelId: string]: {
    [channelId: string]: ChannelData;
  };
}

export interface Product {
  id: string;
  name: string;
  funnels: FunnelStage[];
  channels: Channel[]; // Shared structure for both New and Existing
  data: {
    newChannels: ProductData;
    existingChannels: ProductData;
  };
}
