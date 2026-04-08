import type { CategoryValue } from './constants.js';
import type { Role } from '@prisma/client';

export interface ProductDto {
  id: string;
  name: string;
  position: number;
  layout: {
    channelColumnWidth: number;
  };
  funnels: Array<{
    id: string;
    name: string;
    position: number;
    parentFunnelId: string | null;
    targets: Record<CategoryValue, number>;
  }>;
  channels: Array<{
    id: string;
    name: string;
    position: number;
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

export interface BackupPayload {
  backupVersion: number;
  exportedAt: string;
  globalTargets: GlobalTargetsDto;
  products: ProductDto[];
}

export interface AuthSessionDto {
  authenticated: boolean;
  role: Role | null;
  username: string | null;
}
