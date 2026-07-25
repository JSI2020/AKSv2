"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  advanceProductionJobAction,
  assignProductionJobAction,
} from "../actions";
import type { ProductionJobStage } from "../constants";
import type { ProductionBoardCard, StaffOption } from "../queries";
import type { StaffWorkloadRow } from "../workload";
import { ProductionKanban } from "./production-kanban";

type ProductionBoardClientProps = {
  columns: Record<ProductionJobStage, ProductionBoardCard[]>;
  staff: StaffOption[];
  workload: StaffWorkloadRow[];
};

export function ProductionBoardClient({
  columns,
  staff,
  workload,
}: ProductionBoardClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  async function onAdvance(jobId: string, toStage: ProductionJobStage) {
    const result = await advanceProductionJobAction({ jobId, toStage });
    if (!result.ok) throw new Error(result.error);
    startTransition(() => router.refresh());
  }

  async function onAssign(jobId: string, staffId: string | null) {
    const result = await assignProductionJobAction({ jobId, staffId });
    if (!result.ok) throw new Error(result.error);
    startTransition(() => router.refresh());
  }

  return (
    <ProductionKanban
      initialColumns={columns}
      staff={staff}
      workload={workload}
      onAdvance={onAdvance}
      onAssign={onAssign}
    />
  );
}
