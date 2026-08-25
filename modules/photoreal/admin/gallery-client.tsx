"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { listPhotorealDesignsAction } from "../actions";

type GalleryItem = {
  id: string;
  title: string | null;
  description: string | null;
  totalCost: number;
  totalCostPkr?: number;
  versionCount: number;
  coverUrl: string | null;
  updatedAt: string;
};

export function GalleryClient() {
  const [designs, setDesigns] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listPhotorealDesignsAction()
      .then((data) => {
        if (!data.ok) throw new Error(data.error);
        setDesigns(data.designs);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load gallery.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="text-greige">
      <header className="mb-6 flex items-center justify-between border-b border-indigo-lift pb-3">
        <Link
          href="/admin/photoreal"
          className="inline-flex items-center gap-1.5 text-[13px] text-zari"
        >
          <ArrowLeft className="size-4" />
          Studio
        </Link>
        <h1 className="font-display text-lg text-greige">Gallery</h1>
        <span className="w-16" />
      </header>

      {loading && <p className="text-[13px] text-chalk">Loading saved designs…</p>}
      {error && <p className="text-[13px] text-madder">{error}</p>}
      {!loading && !error && designs.length === 0 && (
        <div className="py-16 text-center">
          <p className="font-display text-2xl text-greige">No saved designs yet</p>
          <p className="mt-2 text-[13px] text-chalk">
            Generate a look, then hit Save on the result screen.
          </p>
          <Link
            href="/admin/photoreal"
            className="mt-6 inline-flex border border-zari px-3 py-1.5 text-[13px] text-zari rounded-[2px]"
          >
            Start a design
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {designs.map((d) => (
          <Link
            key={d.id}
            href={`/admin/photoreal/${d.id}`}
            className="group overflow-hidden border border-indigo-lift transition hover:border-zari rounded-[2px]"
          >
            <div className="aspect-[3/4] bg-indigo-lift/30">
              {d.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={d.coverUrl}
                  alt={d.title || "Design"}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-[11px] text-chalk">
                  No image
                </div>
              )}
            </div>
            <div className="space-y-1 px-3 py-3">
              <p className="truncate text-[13px] text-greige">
                {d.title || "Untitled"}
              </p>
              <p className="text-[11px] text-chalk">
                {d.versionCount} version{d.versionCount === 1 ? "" : "s"} ·{" "}
                {new Intl.NumberFormat("en-PK", {
                  style: "currency",
                  currency: "PKR",
                  maximumFractionDigits: 0,
                }).format(d.totalCostPkr ?? Number(d.totalCost) * 278)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
