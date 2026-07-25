export type FabricAllocationSuccess = {
  status: "RESERVED";
  reservationId: string;
  fabricLotId: string;
  lotCode: string;
  metersReserved: number;
};

export type FabricAllocationInsufficient = {
  status: "INSUFFICIENT";
  fabricId: string;
  metersRequired: number;
  shortfall: number;
  candidateLotIds: string[];
};

export type FabricAllocationResult =
  | FabricAllocationSuccess
  | FabricAllocationInsufficient;

export class FabricStockError extends Error {
  readonly code = "FABRIC_STOCK_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "FabricStockError";
  }
}

export class FabricAllocationError extends Error {
  readonly code = "FABRIC_ALLOCATION_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "FabricAllocationError";
  }
}

/**
 * Fabric is reserved when an order reaches MEASUREMENTS_CONFIRMED — the earliest
 * production-lock point before cutting. DEPOSIT_PAID only confirms payment; measurements
 * and consumption estimates may still change. This aligns with the fabric lock gate on CUTTING.
 */
export const FABRIC_RESERVATION_ORDER_STATUS = "MEASUREMENTS_CONFIRMED" as const;
