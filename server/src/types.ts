import type { Role } from '@prisma/client';
import type { CategoryKey, PeriodView } from './constants.js';

export interface ProductMatrixCellDto {
  visits: number;
  revenue: number;
}

export interface ProductCategoryDto {
  id: string;
  key: CategoryKey;
  layout: {
    channelColumnWidth: number;
  };
  funnels: Array<{
    id: string;
    name: string;
    position: number;
    parentFunnelId: string | null;
    targetVisits: number;
  }>;
  channels: Array<{
    id: string;
    name: string;
    position: number;
  }>;
  weeks: Record<string, Record<string, Record<string, ProductMatrixCellDto>>>;
}

export interface ProductDto {
  id: string;
  name: string;
  position: number;
  categories: Record<CategoryKey, ProductCategoryDto>;
}

export interface GlobalTargetsDto {
  revenue: number;
  newCustomers: number;
  existingCustomers: number;
}

export interface DashboardResponse {
  globalTargets: GlobalTargetsDto;
  period: {
    view: PeriodView;
    referenceDate: string;
    label: string;
    includedWeeks: string[];
  };
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

export interface BackupPayload {
  backupVersion: number;
  exportedAt: string;
  periodRules: {
    inputGrain: 'week';
    weekStartsOn: 'monday';
    periodOwnership: 'weekStartDate';
  };
  globalTargets: GlobalTargetsDto;
  products: ProductDto[];
}

export interface AuthSessionDto {
  authenticated: boolean;
  role: Role | null;
  username: string | null;
}
