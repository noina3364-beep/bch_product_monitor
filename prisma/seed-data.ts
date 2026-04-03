export const DASHBOARD_TARGET_SEED = {
  revenue: 1_000_000,
  newCustomers: 50_000,
  existingCustomers: 100_000,
} as const;

export const PRODUCT_SEED = [
  {
    name: 'Premium Subscription',
    channelColumnWidth: 208,
    funnels: [
      { name: 'Awareness', parentIndex: null, targets: { newChannels: 10_000, existingChannels: 10_000 } },
      { name: 'Consideration', parentIndex: 0, targets: { newChannels: 5_000, existingChannels: 5_000 } },
      { name: 'Conversion', parentIndex: 1, targets: { newChannels: 1_000, existingChannels: 1_000 } },
      { name: 'Retention', parentIndex: 2, targets: { newChannels: 800, existingChannels: 800 } },
    ],
    channels: [
      { name: 'Google Ads' },
      { name: 'Facebook' },
      { name: 'LinkedIn' },
    ],
    data: {
      newChannels: [
        [
          { visits: 2500, revenue: 0 },
          { visits: 1800, revenue: 0 },
          { visits: 1200, revenue: 0 },
        ],
        [
          { visits: 1200, revenue: 0 },
          { visits: 900, revenue: 0 },
          { visits: 600, revenue: 0 },
        ],
        [
          { visits: 300, revenue: 4500 },
          { visits: 200, revenue: 3000 },
          { visits: 150, revenue: 2250 },
        ],
        [
          { visits: 250, revenue: 3750 },
          { visits: 180, revenue: 2700 },
          { visits: 120, revenue: 1800 },
        ],
      ],
      existingChannels: [
        [
          { visits: 1500, revenue: 0 },
          { visits: 1200, revenue: 0 },
          { visits: 800, revenue: 0 },
        ],
        [
          { visits: 800, revenue: 0 },
          { visits: 600, revenue: 0 },
          { visits: 400, revenue: 0 },
        ],
        [
          { visits: 200, revenue: 3000 },
          { visits: 150, revenue: 2250 },
          { visits: 100, revenue: 1500 },
        ],
        [
          { visits: 180, revenue: 2700 },
          { visits: 140, revenue: 2100 },
          { visits: 90, revenue: 1350 },
        ],
      ],
    },
  },
] as const;
