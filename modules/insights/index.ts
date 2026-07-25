export {
  listCustomers,
  getCustomerRelated,
  getDesignRelated,
  getFabricRelated,
  getOrderFabricLots,
  getStaffRelated,
} from "./queries-related";
export type {
  CustomerListItem,
  CustomerRelatedData,
  DesignRelatedData,
  FabricRelatedData,
  OrderFabricLotRow,
  StaffRelatedData,
} from "./queries-related";

export { getInsightsReportData } from "./queries-reports";
export type { InsightsReportData } from "./queries-reports";

export {
  CustomerRelatedPanels,
  DesignRelatedPanels,
  FabricRelatedPanels,
  OrderFabricLotsPanel,
  StaffRelatedPanels,
} from "./related-panels";

export { InsightsDashboard } from "./insights-dashboard";
export { ReportTable } from "./report-table";
export { CustomersTable } from "./customers-table";
