export { allocateFabric, maybeEnqueueLowStockAlert } from "./allocate-fabric";
export {
  reserveFabricForOrder,
  releaseFabricForOrder,
  consumeFabricAtCutting,
} from "./order-lifecycle";
export { lotAvailableMeters } from "./lot-status";
export {
  FABRIC_RESERVATION_ORDER_STATUS,
  FabricAllocationError,
  FabricStockError,
} from "./types";
export type {
  FabricAllocationResult,
  FabricAllocationSuccess,
  FabricAllocationInsufficient,
} from "./types";
