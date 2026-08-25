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
        className="cart-drawer-scrim"
        data-open={drawerOpen ? "true" : "false"}
        aria-hidden={!drawerOpen}
        onClick={closeDrawer}
      />

      <aside
        className="cart-drawer"
        data-open={drawerOpen ? "true" : "false"}
        aria-hidden={!drawerOpen}
        aria-label="Shopping cart"
      >
        <header className="cart-drawer-head flex items-center justify-between border-b px-5 py-4">
          <h2 className="serif text-[18px] font-medium">Your cart</h2>
          <button
            type="button"
            onClick={closeDrawer}
            className="btn-ghost"
            aria-label="Close cart"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cart.lines.length === 0 ? (
            <p className="text-[15px] leading-relaxed" style={{ color: "var(--taupe)" }}>
              Empty for now. Everything we make begins the moment you choose it.
            </p>
          ) : (
            <ul className="space-y-5">
              {cart.lines.map((line) => (
                <li
                  key={line.id}
                  className="cart-drawer-line grid grid-cols-[72px_1fr] gap-3 pb-5"
                >
                  <div
                    className="relative aspect-[3/4]"
                    style={{ background: "var(--bone)" }}
                  >
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
                      <div
                        className="flex size-full items-center justify-center text-[10px] uppercase tracking-[0.08em]"
                        style={{ color: "var(--taupe)" }}
                      >
                        AKS
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <Link
                      href={`/designs/${line.designSlug}`}
                      className="serif block truncate text-[15px]"
                      style={{ color: "var(--ink)" }}
                      onClick={closeDrawer}
                    >
                      {line.designName}
                    </Link>
                    <p
                      className="mt-0.5 text-[13px]"
                      style={{ color: "var(--taupe)" }}
                    >
                      {line.colourwayName}
                    </p>
                    <p
                      className="text-[12px] uppercase tracking-[0.06em]"
                      style={{ color: "var(--taupe)" }}
                    >
                      {sizeLabel(line)}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="cart-drawer-qty">
                        <button
                          type="button"
                          disabled={pending || line.quantity <= 1}
                          onClick={() =>
                            setLineQuantity(line.id, line.quantity - 1)
                          }
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
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-end">
                        <span style={{ color: "var(--taupe)" }}>
                          <Money
                            value={line.unitPriceMinor}
                            className="block text-[12px]"
                          />
                        </span>
                        <span style={{ color: "var(--ink)" }}>
                          <Money
                            value={line.lineTotalMinor}
                            className="block text-[14px]"
                          />
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => removeLine(line.id)}
                      className="cart-drawer-remove"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="cart-drawer-foot border-t px-5 py-5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span
              className="text-[13px] uppercase tracking-[0.08em]"
              style={{ color: "var(--taupe)" }}
            >
              Subtotal
            </span>
            <Money
              value={cart.subtotalMinor}
              className="text-[18px]"
            />
          </div>
          <p
            className="mb-4 text-[13px] leading-relaxed"
            style={{ color: "var(--taupe)" }}
          >
            {cart.leadTimeLabel}
          </p>
          <Link
            href="/checkout"
            onClick={closeDrawer}
            className="btn-primary"
            aria-disabled={cart.lines.length === 0}
            tabIndex={cart.lines.length === 0 ? -1 : undefined}
          >
            Checkout
          </Link>
        </footer>
      </aside>
    </>
  );
}
