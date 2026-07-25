"use client";

import Image from "next/image";

import { Link } from "@/i18n/routing";
import { Money } from "@/modules/ui";

import { useCart } from "./cart-context";

function sizeLabel(line: {
  sizeMode: "STANDARD" | "MADE_TO_MEASURE";
  sizeLabel: string | null;
}) {
  if (line.sizeMode === "MADE_TO_MEASURE") return "Made to measure";
  return line.sizeLabel ?? "—";
}

export function CartDrawer() {
  const { cart, drawerOpen, closeDrawer, setLineQuantity, removeLine, pending } =
    useCart();

  return (
    <>
      <div
        className={
          drawerOpen
            ? "fixed inset-0 z-50 bg-ink/40 transition-opacity"
            : "pointer-events-none fixed inset-0 z-50 bg-transparent opacity-0"
        }
        aria-hidden={!drawerOpen}
        onClick={closeDrawer}
      />

      <aside
        className={
          drawerOpen
            ? "fixed inset-y-0 end-0 z-[60] flex w-full max-w-[420px] translate-x-0 flex-col border-s border-greige-deep bg-greige text-ink transition-transform duration-200"
            : "fixed inset-y-0 end-0 z-[60] flex w-full max-w-[420px] translate-x-full flex-col border-s border-greige-deep bg-greige text-ink transition-transform duration-200"
        }
        aria-hidden={!drawerOpen}
        aria-label="Shopping cart"
      >
        <header className="flex items-center justify-between border-b border-greige-deep px-5 py-4">
          <h2 className="font-display text-[18px] font-medium">Your cart</h2>
          <button
            type="button"
            onClick={closeDrawer}
            className="border border-greige-deep px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] text-ink"
            aria-label="Close cart"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cart.lines.length === 0 ? (
            <p className="text-[15px] leading-relaxed text-ink/70">
              Empty for now. Everything we make begins the moment you choose it.
            </p>
          ) : (
            <ul className="space-y-5">
              {cart.lines.map((line) => (
                <li
                  key={line.id}
                  className="grid grid-cols-[72px_1fr] gap-3 border-b border-greige-deep pb-5"
                >
                  <div className="relative aspect-[3/4] bg-greige-deep/50">
                    {line.thumbnailUrl ? (
                      <Image
                        src={line.thumbnailUrl}
                        alt={line.designName}
                        fill
                        sizes="72px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-[10px] uppercase tracking-[0.08em] text-ink/40">
                        AKS
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <Link
                      href={`/designs/${line.designSlug}`}
                      className="block truncate font-display text-[15px] text-ink"
                      onClick={closeDrawer}
                    >
                      {line.designName}
                    </Link>
                    <p className="mt-0.5 text-[13px] text-ink/65">
                      {line.colourwayName}
                    </p>
                    <p className="text-[12px] uppercase tracking-[0.06em] text-ink/55">
                      {sizeLabel(line)}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center border border-greige-deep">
                        <button
                          type="button"
                          disabled={pending || line.quantity <= 1}
                          onClick={() =>
                            setLineQuantity(line.id, line.quantity - 1)
                          }
                          className="px-2.5 py-1.5 text-[14px] text-ink disabled:opacity-40"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="min-w-[2rem] px-2 text-center font-data text-[13px]">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={pending || line.quantity >= 99}
                          onClick={() =>
                            setLineQuantity(line.id, line.quantity + 1)
                          }
                          className="px-2.5 py-1.5 text-[14px] text-ink disabled:opacity-40"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-end">
                        <Money
                          value={line.unitPriceMinor}
                          className="block text-[12px] text-ink/55"
                        />
                        <Money
                          value={line.lineTotalMinor}
                          className="block text-[14px] text-ink"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => removeLine(line.id)}
                      className="mt-2 text-[12px] uppercase tracking-[0.06em] text-madder"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-greige-deep px-5 py-5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-[13px] uppercase tracking-[0.08em] text-ink/55">
              Subtotal
            </span>
            <Money value={cart.subtotalMinor} className="text-[18px] text-ink" />
          </div>
          <p className="mb-4 text-[13px] leading-relaxed text-ink/65">
            {cart.leadTimeLabel}
          </p>
          <button
            type="button"
            disabled={cart.lines.length === 0}
            className="w-full border border-ink bg-ink px-4 py-3 text-[12px] uppercase tracking-[0.08em] text-greige disabled:opacity-40"
          >
            Checkout
          </button>
        </footer>
      </aside>
    </>
  );
}
