export const DASHBOARD_TARGET_SEED = {
  revenue: 250_000,
  newCustomers: 12_500,
  existingCustomers: 18_000,
} as const;

const newWeeks = {
  '2026-04-06': [
    [
      { visits: 2200, revenue: 0 },
      { visits: 1600, revenue: 0 },
      { visits: 1100, revenue: 0 },
    ],
    [
      { visits: 1100, revenue: 0 },
      { visits: 820, revenue: 0 },
      { visits: 540, revenue: 0 },
    ],
    [
      { visits: 280, revenue: 4200 },
      { visits: 190, revenue: 2850 },
      { visits: 120, revenue: 1800 },
    ],
    [
      { visits: 230, revenue: 3450 },
      { visits: 160, revenue: 2400 },
      { visits: 96, revenue: 1440 },
    ],
  ],
  '2026-04-13': [
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
  '2026-04-20': [
    [
      { visits: 2650, revenue: 0 },
      { visits: 1910, revenue: 0 },
      { visits: 1275, revenue: 0 },
    ],
    [
      { visits: 1310, revenue: 0 },
      { visits: 965, revenue: 0 },
      { visits: 640, revenue: 0 },
    ],
    [
      { visits: 330, revenue: 4950 },
      { visits: 225, revenue: 3375 },
      { visits: 165, revenue: 2475 },
    ],
    [
      { visits: 275, revenue: 4125 },
      { visits: 196, revenue: 2940 },
      { visits: 132, revenue: 1980 },
    ],
  ],
} as const;

const existingWeeks = {
  '2026-04-06': [
    [
      { visits: 1350, revenue: 0 },
      { visits: 1090, revenue: 0 },
      { visits: 740, revenue: 0 },
    ],
    [
      { visits: 720, revenue: 0 },
      { visits: 560, revenue: 0 },
      { visits: 360, revenue: 0 },
    ],
    [
      { visits: 180, revenue: 2700 },
      { visits: 135, revenue: 2025 },
      { visits: 88, revenue: 1320 },
    ],
    [
      { visits: 160, revenue: 2400 },
      { visits: 125, revenue: 1875 },
      { visits: 80, revenue: 1200 },
    ],
  ],
  '2026-04-13': [
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
  '2026-04-20': [
    [
      { visits: 1620, revenue: 0 },
      { visits: 1280, revenue: 0 },
      { visits: 860, revenue: 0 },
    ],
    [
      { visits: 860, revenue: 0 },
      { visits: 635, revenue: 0 },
      { visits: 430, revenue: 0 },
    ],
    [
      { visits: 214, revenue: 3210 },
      { visits: 160, revenue: 2400 },
      { visits: 108, revenue: 1620 },
    ],
    [
      { visits: 192, revenue: 2880 },
      { visits: 148, revenue: 2220 },
      { visits: 94, revenue: 1410 },
    ],
  ],
} as const;

export const PRODUCT_SEED = [
  {
    name: 'Premium Subscription',
    categories: {
      new: {
        channelColumnWidth: 208,
        funnels: [
          { name: 'Awareness', parentIndex: null, targetVisits: 10_000 },
          { name: 'Consideration', parentIndex: 0, targetVisits: 5_000 },
          { name: 'Conversion', parentIndex: 1, targetVisits: 1_000 },
          { name: 'Retention', parentIndex: 2, targetVisits: 800 },
        ],
        channels: [{ name: 'Google Ads' }, { name: 'Facebook' }, { name: 'LinkedIn' }],
        weeks: newWeeks,
      },
      existing: {
        channelColumnWidth: 208,
        funnels: [
          { name: 'Awareness', parentIndex: null, targetVisits: 7_500 },
          { name: 'Nurture', parentIndex: 0, targetVisits: 3_500 },
          { name: 'Conversion', parentIndex: 1, targetVisits: 850 },
          { name: 'Retention', parentIndex: 2, targetVisits: 720 },
        ],
        channels: [{ name: 'CRM Broadcast' }, { name: 'Facebook' }, { name: 'Website' }],
        weeks: existingWeeks,
      },
    },
  },
] as const;
