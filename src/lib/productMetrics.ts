import type {
  ChannelData,
  GlobalTargets,
  PeriodSelection,
  Product,
  ProductCategoryKey,
  ProductCategoryState,
} from '../types';
import { getIncludedWeekKeys } from './periods';

const EMPTY_CELL: ChannelData = { visits: 0, revenue: 0 };

export function getCategory(categoryProduct: Product, category: ProductCategoryKey) {
  return categoryProduct.categories[category];
}

export function getCategoryWeekKeys(category: ProductCategoryState) {
  return Object.keys(category.weeks).sort();
}

export function getCellValue(
  category: ProductCategoryState,
  period: PeriodSelection,
  funnelId: string,
  channelId: string,
) {
  const includedWeeks = getIncludedWeekKeys(period.view, period.referenceDate);

  return includedWeeks.reduce<ChannelData>(
    (total, weekKey) => {
      const cell = category.weeks[weekKey]?.[funnelId]?.[channelId];
      if (!cell) {
        return total;
      }

      total.visits += cell.visits;
      total.revenue += cell.revenue;
      return total;
    },
    { visits: 0, revenue: 0 },
  );
}

export function getFunnelTotals(
  category: ProductCategoryState,
  period: PeriodSelection,
  funnelId: string,
) {
  return category.channels.reduce(
    (totals, channel) => {
      const cell = getCellValue(category, period, funnelId, channel.id);
      totals.visits += cell.visits;
      totals.revenue += cell.revenue;
      return totals;
    },
    { visits: 0, revenue: 0 },
  );
}

export function getCategoryActuals(category: ProductCategoryState, period: PeriodSelection) {
  return category.funnels.reduce(
    (totals, funnel) => {
      const funnelTotals = getFunnelTotals(category, period, funnel.id);
      totals.visits += funnelTotals.visits;
      totals.revenue += funnelTotals.revenue;
      return totals;
    },
    { visits: 0, revenue: 0 },
  );
}

export function getProductActuals(product: Product, period: PeriodSelection) {
  const newActuals = getCategoryActuals(product.categories.new, period);
  const existingActuals = getCategoryActuals(product.categories.existing, period);

  return {
    revenue: newActuals.revenue + existingActuals.revenue,
    newVisits: newActuals.visits,
    existingVisits: existingActuals.visits,
  };
}

export function getScaledGlobalTargets(globalTargets: GlobalTargets, period: PeriodSelection) {
  const multiplier = getIncludedWeekKeys(period.view, period.referenceDate).length;
  return {
    revenue: globalTargets.revenue * multiplier,
    newCustomers: globalTargets.newCustomers * multiplier,
    existingCustomers: globalTargets.existingCustomers * multiplier,
  };
}

export function getParentFunnel(category: ProductCategoryState, funnelId: string) {
  const funnel = category.funnels.find((entry) => entry.id === funnelId);
  return funnel?.parentFunnelId
    ? category.funnels.find((entry) => entry.id === funnel.parentFunnelId) ?? null
    : null;
}

export function getConversionRate(
  category: ProductCategoryState,
  period: PeriodSelection,
  funnelId: string,
  channelId?: string,
) {
  const parentFunnel = getParentFunnel(category, funnelId);
  if (!parentFunnel) {
    return null;
  }

  if (channelId) {
    const current = getCellValue(category, period, funnelId, channelId).visits;
    const previous = getCellValue(category, period, parentFunnel.id, channelId).visits;
    if (previous === 0) {
      return 0;
    }

    return current / previous;
  }

  const current = getFunnelTotals(category, period, funnelId).visits;
  const previous = getFunnelTotals(category, period, parentFunnel.id).visits;
  if (previous === 0) {
    return 0;
  }

  return current / previous;
}

export function getTargetValue(targetVisits: number, period: PeriodSelection) {
  return targetVisits * getIncludedWeekKeys(period.view, period.referenceDate).length;
}

export function getTargetDiff(actual: number, target: number) {
  if (target === 0) {
    return 0;
  }

  return (actual - target) / target;
}

export function getAvailableYears(products: Product[]) {
  const years = new Set<number>();

  for (const product of products) {
    for (const categoryKey of ['new', 'existing'] as const) {
      for (const weekKey of getCategoryWeekKeys(product.categories[categoryKey])) {
        years.add(Number(weekKey.slice(0, 4)));
      }
    }
  }

  const currentYear = new Date().getUTCFullYear();
  years.add(currentYear);
  years.add(currentYear - 1);
  years.add(currentYear + 1);

  return [...years].sort((a, b) => a - b);
}

export function getWeekCellOrEmpty(
  category: ProductCategoryState,
  weekStartDate: string,
  funnelId: string,
  channelId: string,
) {
  return category.weeks[weekStartDate]?.[funnelId]?.[channelId] ?? EMPTY_CELL;
}
