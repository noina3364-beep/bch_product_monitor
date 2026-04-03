import { Product } from '../types';

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Premium Subscription',
    funnels: [
      { id: 'f1', name: 'Awareness', targets: { newChannels: 10000, existingChannels: 10000 } },
      { id: 'f2', name: 'Consideration', targets: { newChannels: 5000, existingChannels: 5000 } },
      { id: 'f3', name: 'Conversion', targets: { newChannels: 1000, existingChannels: 1000 } },
      { id: 'f4', name: 'Retention', targets: { newChannels: 800, existingChannels: 800 } },
    ],
    channels: [
      { id: 'c1', name: 'Google Ads' },
      { id: 'c2', name: 'Facebook' },
      { id: 'c3', name: 'LinkedIn' },
    ],
    data: {
      newChannels: {
        f1: { c1: { visits: 2500, revenue: 0 }, c2: { visits: 1800, revenue: 0 }, c3: { visits: 1200, revenue: 0 } },
        f2: { c1: { visits: 1200, revenue: 0 }, c2: { visits: 900, revenue: 0 }, c3: { visits: 600, revenue: 0 } },
        f3: { c1: { visits: 300, revenue: 4500 }, c2: { visits: 200, revenue: 3000 }, c3: { visits: 150, revenue: 2250 } },
        f4: { c1: { visits: 250, revenue: 3750 }, c2: { visits: 180, revenue: 2700 }, c3: { visits: 120, revenue: 1800 } },
      },
      existingChannels: {
        f1: { c1: { visits: 1500, revenue: 0 }, c2: { visits: 1200, revenue: 0 }, c3: { visits: 800, revenue: 0 } },
        f2: { c1: { visits: 800, revenue: 0 }, c2: { visits: 600, revenue: 0 }, c3: { visits: 400, revenue: 0 } },
        f3: { c1: { visits: 200, revenue: 3000 }, c2: { visits: 150, revenue: 2250 }, c3: { visits: 100, revenue: 1500 } },
        f4: { c1: { visits: 180, revenue: 2700 }, c2: { visits: 140, revenue: 2100 }, c3: { visits: 90, revenue: 1350 } },
      },
    },
  },
];
