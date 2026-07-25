export {
  computeDesignCost,
  computeFabricCostMinor,
  computeMarginPercent,
  formatMarginPercent,
  marginColorClass,
  monthlyAmountMinor,
} from "./compute";
export type {
  DesignCostBreakdown,
  DesignCostInputs,
  RateRow,
  RecurringCostCycle,
} from "./compute";

export {
  getDesignCostingData,
  getMoneyDashboardData,
  listActiveRates,
} from "./queries";
export type {
  DesignCostingData,
  MarginRankRow,
  MoneyDashboardData,
  RecurringCostRow,
  RevenuePeriod,
} from "./queries";

export {
  saveDesignCosting,
  upsertRate,
  upsertRecurringCost,
} from "./actions";
export type { MoneyActionResult } from "./actions";

export { DesignCostingPanel } from "./design-costing-panel";
export { MoneyDashboard } from "./money-dashboard";
