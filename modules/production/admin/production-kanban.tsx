"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import {
  PRODUCTION_JOB_STAGES,
  PRODUCTION_STAGE_LABELS,
  type ProductionJobStage,
} from "../constants";
import type { ProductionBoardCard, StaffOption } from "../queries";
import type { StaffWorkloadRow } from "../workload";
import { ProductionCard } from "./production-card";
import { ProductionFilters } from "./production-filters";
import { WorkloadPanel } from "./workload-panel";

type ProductionKanbanProps = {
  initialColumns: Record<ProductionJobStage, ProductionBoardCard[]>;
  staff: StaffOption[];
  workload: StaffWorkloadRow[];
  onAdvance: (jobId: string, toStage: ProductionJobStage) => Promise<void>;
  onAssign: (jobId: string, staffId: string | null) => Promise<void>;
};

function SortableCard({
  card,
  staff,
  onAssign,
}: {
  card: ProductionBoardCard;
  staff: StaffOption[];
  onAssign: (jobId: string, staffId: string | null) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
    >
      <ProductionCard
        card={card}
        staff={staff}
        onAssign={onAssign}
        dragging={isDragging}
      />
    </div>
  );
}

function Column({
  stage,
  cards,
  staff,
  onAssign,
}: {
  stage: ProductionJobStage;
  cards: ProductionBoardCard[];
  staff: StaffOption[];
  onAssign: (jobId: string, staffId: string | null) => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const ids = useMemo(() => cards.map((c) => c.id), [cards]);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-[min(100%,17rem)] shrink-0 flex-col border bg-indigo-lift/40",
        isOver ? "border-zari" : "border-chalk/25",
      )}
      data-stage={stage}
    >
      <header className="border-b border-chalk/20 px-3 py-2">
        <h2 className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          {PRODUCTION_STAGE_LABELS[stage]}
        </h2>
        <p className="font-mono text-[11px] text-greige/70">{cards.length}</p>
      </header>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[12rem] flex-col gap-2 p-2">
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              staff={staff}
              onAssign={onAssign}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

export function ProductionKanban({
  initialColumns,
  staff,
  workload,
  onAdvance,
  onAssign,
}: ProductionKanbanProps) {
  const [columns, setColumns] = useState(initialColumns);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const activeCard = useMemo(() => {
    if (!activeId) return null;
    for (const stage of PRODUCTION_JOB_STAGES) {
      const found = columns[stage]?.find((c) => c.id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, columns]);

  function findStage(jobId: string): ProductionJobStage | null {
    for (const stage of PRODUCTION_JOB_STAGES) {
      if (columns[stage]?.some((c) => c.id === jobId)) return stage;
    }
    return null;
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const jobId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || busy) return;

    const fromStage = findStage(jobId);
    if (!fromStage) return;

    let toStage: ProductionJobStage | null = null;

    if ((PRODUCTION_JOB_STAGES as readonly string[]).includes(overId)) {
      toStage = overId as ProductionJobStage;
    } else {
      toStage = findStage(overId);
    }

    if (!toStage || toStage === fromStage || toStage === "PACKED") return;

    const fromIndex = PRODUCTION_JOB_STAGES.indexOf(fromStage);
    const toIndex = PRODUCTION_JOB_STAGES.indexOf(toStage);
    if (toIndex !== fromIndex + 1) return;

    const card = columns[fromStage]?.find((c) => c.id === jobId);
    if (!card) return;

    setBusy(true);
    const prev = columns;
    setColumns((current) => {
      const next = { ...current };
      next[fromStage] = next[fromStage].filter((c) => c.id !== jobId);
      next[toStage!] = [...(next[toStage!] ?? []), { ...card, stage: toStage! }];
      return next;
    });

    try {
      await onAdvance(jobId, toStage);
    } catch {
      setColumns(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <ProductionFilters staff={staff} />
      <WorkloadPanel rows={workload} />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="-mx-4 overflow-x-auto px-4 pb-2">
          <div className="flex min-w-max gap-3">
            {PRODUCTION_JOB_STAGES.filter((s) => s !== "PACKED").map((stage) => (
              <Column
                key={stage}
                stage={stage}
                cards={columns[stage] ?? []}
                staff={staff}
                onAssign={onAssign}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {activeCard ? (
            <ProductionCard
              card={activeCard}
              staff={staff}
              onAssign={onAssign}
              dragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
