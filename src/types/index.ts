export interface FunnelStage {
  id: string;
  name: string;
  target: number;
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

export type CategoryType = 'newChannels' | 'existingChannels';
