"use client";

import { Button } from "@/components/ui/button";
import {
  AsyncBoundary,
  ConfirmDialog,
  EmptyState,
  Eyebrow,
  Ground,
  Measure,
  Money,
  StitchRule,
} from "@/modules/ui";

export function PrimitivesDemo() {
  return (
    <section className="mt-12 space-y-8">
      <Eyebrow>Primitives</Eyebrow>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="border border-indigo-lift p-4">
          <Eyebrow className="mb-3 text-chalk">Money</Eyebrow>
          <p className="text-greige">
            <Money value={4550000} currency="PKR" />
          </p>
        </div>
        <div className="border border-indigo-lift p-4">
          <Eyebrow className="mb-3 text-chalk">Measure</Eyebrow>
          <p className="text-greige">
            <Measure value={3050} unit="in" />
          </p>
        </div>
      </div>

      <StitchRule />

      <div className="grid gap-4 md:grid-cols-2">
        <Ground variant="greige" className="border border-indigo-lift p-4">
          <Eyebrow className="mb-2">Ground · greige</Eyebrow>
          <p className="font-sans text-sm">Storefront surface</p>
        </Ground>
        <Ground
          variant="indigo"
          className="border border-indigo-lift p-4 min-block-size-0"
        >
          <Eyebrow className="mb-2 text-chalk">Ground · indigo</Eyebrow>
          <p className="font-sans text-sm text-greige">Admin surface</p>
        </Ground>
      </div>

      <Ground variant="greige" className="p-4">
        <EmptyState
          title="No designs yet"
          description="Upload a sketch when you are ready — this is an invitation, not an error."
          action={
            <Button type="button" variant="outline">
              Create design
            </Button>
          }
        />
      </Ground>

      <div className="border border-indigo-lift p-4">
        <Eyebrow className="mb-3 text-chalk">AsyncBoundary</Eyebrow>
        <AsyncBoundary>
          <p className="font-sans text-sm text-greige">Content loaded.</p>
        </AsyncBoundary>
      </div>

      <div className="border border-indigo-lift p-4">
        <Eyebrow className="mb-3 text-chalk">ConfirmDialog</Eyebrow>
        <ConfirmDialog
          title="Delete this record?"
          description="This cannot be undone."
          confirmLabel="Delete"
          trigger={
            <Button type="button" variant="destructive">
              Delete…
            </Button>
          }
          onConfirm={() => undefined}
        />
      </div>
    </section>
  );
}
