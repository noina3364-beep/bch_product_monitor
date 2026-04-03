import type { CategoryValue } from './constants.js';

export interface ProductDto {
  id: string;
  name: string;
  funnels: Array<{
    id: string;
    name: string;
    targets: Record<CategoryValue, number>;
  }>;
  channels: Array<{
    id: string;
    name: string;
  }>;
  data: Record<CategoryValue, Record<string, Record<string, { visits: number; revenue: number }>>>;
}

export interface GlobalTargetsDto {
  revenue: number;
  newCustomers: number;
  existingCustomers: number;
}

export interface DashboardResponse {
  globalTargets: GlobalTargetsDto;
  globalActuals: {
    revenue: number;
    newVisits: number;
    existingVisits: number;
  };
  productBreakdown: Array<{
    id: string;
    name: string;
    revenue: number;
    newVisits: number;
    existingVisits: number;
  }>;
}
