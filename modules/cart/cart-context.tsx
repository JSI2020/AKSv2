"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { rtwStockCapMessage } from "@/modules/inventory/rtw-stock-messages";

import {
  addToCart,
  fetchCart,
  removeCartLine,
  restoreBag,
  updateCartLineQuantity,
} from "./actions";
import {
  bagOrderedThisSession,
  cartFromStoredBag,
  clearBagOrderedFlag,
  markBagOrdered,
  readStoredBag,
  writeStoredBag,
} from "./bag-storage";
import { isPersistedCartLineId } from "./line-id";
import type { AddToCartInput, CartLinePublic, CartPublic } from "./types";

type OptimisticMeta = {
  designSlug: string;
  designName: string;
  colourwayName: string;
  unitPriceMinor: number;
  thumbnailUrl: string | null;
  leadTimeDays: number | null;
  maxQuantity: number | null;
};

type CartContextValue = {
  cart: CartPublic;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  addItem: (
    input: AddToCartInput,
    designMeta: OptimisticMeta,
  ) => Promise<{ ok: boolean; error?: string }>;
  setLineQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  /** Drop the bag after a successful order so it does not come back. */
  clearBag: () => void;
  pending: boolean;
  /** False until the browser bag has been read. Checkout waits on this. */
  bagHydrated: boolean;
  cartNotice: string | null;
  clearCartNotice: () => void;
  /** Design name for add-to-cart toast (prototype C). */
  lastAddedName: string | null;
  clearLastAdded: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function summarize(lines: CartLinePublic[]): Pick<CartPublic, "itemCount" | "subtotalMinor"> {
  return {
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    subtotalMinor: lines.reduce((sum, l) => sum + l.lineTotalMinor, 0),
  };
}

function optimisticLine(input: AddToCartInput, designMeta: OptimisticMeta): CartLinePublic {
  return {
    id: `optimistic-${Date.now()}`,
    designId: input.designId,
    designSlug: designMeta.designSlug,
    designName: designMeta.designName,
    colourwayId: input.colourwayId,
    colourwayName: designMeta.colourwayName,
    sizeMode: input.sizeMode,
    sizeLabel: input.sizeLabel,
    quantity: input.quantity,
    maxQuantity: designMeta.maxQuantity,
    unitPriceMinor: designMeta.unitPriceMinor,
    lineTotalMinor: designMeta.unitPriceMinor * input.quantity,
    thumbnailUrl: designMeta.thumbnailUrl,
    leadTimeDays: designMeta.leadTimeDays,
  };
}

function lineIdentityKey(line: {
  designId: string;
  colourwayId: string;
  sizeMode: string;
  sizeLabel: string | null;
}): string {
  return `${line.designId}|${line.colourwayId}|${line.sizeMode}|${line.sizeLabel ?? ""}`;
}

function capLineQuantity(line: CartLinePublic, quantity: number): number {
  const cap = line.maxQuantity ?? 99;
  return Math.max(1, Math.min(cap, quantity));
}

function mergeLineIntoCart(cart: CartPublic, line: CartLinePublic): CartPublic {
  const existing = cart.lines.find(
    (l) =>
      l.designId === line.designId &&
      l.colourwayId === line.colourwayId &&
      l.sizeMode === line.sizeMode &&
      l.sizeLabel === line.sizeLabel,
  );

  const lines = existing
    ? cart.lines.map((l) =>
        l.id === existing.id
          ? (() => {
              const nextQty = capLineQuantity(l, l.quantity + line.quantity);
              return {
                ...l,
                quantity: nextQty,
                lineTotalMinor: l.unitPriceMinor * nextQty,
                maxQuantity: line.maxQuantity ?? l.maxQuantity,
              };
            })()
          : l,
      )
    : [...cart.lines, line];

  return { ...cart, lines, ...summarize(lines) };
}

export function CartProvider({
  initialCart,
  children,
}: {
  initialCart: CartPublic;
  children: ReactNode;
}) {
  const [cart, setCart] = useState(initialCart);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [bagHydrated, setBagHydrated] = useState(false);
  const [lastAddedName, setLastAddedName] = useState<string | null>(null);
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const drawerOpenRef = useRef(drawerOpen);
  drawerOpenRef.current = drawerOpen;
  const pendingLineOps = useRef(
    new Map<string, { quantity: number | "remove" }>(),
  );
  const hydratedRef = useRef(false);

  // Keep client cart aligned when the server layout re-hydrates (e.g. after consolidate).
  const serverStamp = `${initialCart.id}:${initialCart.lines
    .map((l) => `${l.id}:${l.quantity}`)
    .join(",")}`;
  const [seenStamp, setSeenStamp] = useState(serverStamp);
  if (serverStamp !== seenStamp) {
    setSeenStamp(serverStamp);
    if (bagOrderedThisSession()) {
      setCart((prev) =>
        prev.lines.length === 0
          ? prev
          : { ...prev, lines: [], itemCount: 0, subtotalMinor: 0 },
      );
    } else if (initialCart.lines.length > 0 || cart.lines.length === 0) {
      // An empty server payload must not wipe a bag that is still saving
      // or was restored from this browser.
      setCart(initialCart);
    }
  }

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      if (initialCart.lines.length === 0 && !bagOrderedThisSession()) {
        const stored = readStoredBag();
        if (stored.length > 0) {
          setCart(cartFromStoredBag(stored));
          setBagHydrated(true);
          startTransition(async () => {
            const result = await restoreBag(
              stored.map((line) => ({
                designId: line.designId,
                colourwayId: line.colourwayId,
                sizeMode: line.sizeMode,
                sizeLabel: line.sizeLabel,
                quantity: line.quantity,
              })),
            );
            if (result.ok) setCart(result.cart);
            else setCartNotice(result.error);
          });
          return;
        }
      }
      setBagHydrated(true);
    }
    if (bagOrderedThisSession() && cart.lines.length > 0) return;
    writeStoredBag(cart);
  }, [cart, initialCart.lines.length, startTransition]);

  const refreshCart = useCallback(() => {
    startTransition(async () => {
      try {
        const fresh = await fetchCart();
        setCart(fresh);
      } catch {
        // Keep optimistic client cart if refresh fails.
      }
    });
  }, [startTransition]);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    refreshCart();
  }, [refreshCart]);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => {
    const next = !drawerOpenRef.current;
    setDrawerOpen(next);
    if (next) refreshCart();
  }, [refreshCart]);
  const clearLastAdded = useCallback(() => setLastAddedName(null), []);
  const clearCartNotice = useCallback(() => setCartNotice(null), []);

  const clearBag = useCallback(() => {
    markBagOrdered();
    setCart((prev) => ({
      ...prev,
      lines: [],
      itemCount: 0,
      subtotalMinor: 0,
    }));
  }, []);

  const addItem = useCallback(
    async (input: AddToCartInput, designMeta: OptimisticMeta) => {
      clearBagOrderedFlag();
      const draft = optimisticLine(input, designMeta);
      const draftId = draft.id;

      setCart((prev) => mergeLineIntoCart(prev, draft));
      setDrawerOpen(true);

      const result = await addToCart(input);
      if (result.ok) {
        const key = lineIdentityKey({
          designId: input.designId,
          colourwayId: input.colourwayId,
          sizeMode: input.sizeMode,
          sizeLabel: input.sizeLabel,
        });
        const pendingOp = pendingLineOps.current.get(key);
        pendingLineOps.current.delete(key);

        if (pendingOp?.quantity === "remove") {
          const removed = await removeCartLine({ lineId: result.lineId });
          setCart(removed.ok ? removed.cart : result.cart);
        } else if (
          typeof pendingOp?.quantity === "number" &&
          pendingOp.quantity !== input.quantity
        ) {
          const updated = await updateCartLineQuantity({
            lineId: result.lineId,
            quantity: pendingOp.quantity,
          });
          setCart(updated.ok ? updated.cart : result.cart);
        } else {
          setCart(result.cart);
        }

        setCartNotice(null);
        setLastAddedName(
          `${designMeta.designName} — ${designMeta.colourwayName}`,
        );
        return { ok: true };
      }

      setCart((prev) => {
        const lines = prev.lines.flatMap((line) => {
          if (line.id !== draftId) return [line];
          if (line.quantity <= input.quantity) return [];
          return [
            {
              ...line,
              quantity: line.quantity - input.quantity,
              lineTotalMinor: line.unitPriceMinor * (line.quantity - input.quantity),
            },
          ];
        });
        return { ...prev, lines, ...summarize(lines) };
      });

      return { ok: false, error: result.error };
    },
    [],
  );

  const setLineQuantity = useCallback((lineId: string, quantity: number) => {
    let nextQuantity = quantity;
    let blockedNotice: string | null = null;
    let identity: {
      designId: string;
      colourwayId: string;
      sizeMode: CartLinePublic["sizeMode"];
      sizeLabel: string | null;
    } | null = null;

    setCart((prev) => {
      const line = prev.lines.find((l) => l.id === lineId);
      if (!line) return prev;
      identity = {
        designId: line.designId,
        colourwayId: line.colourwayId,
        sizeMode: line.sizeMode,
        sizeLabel: line.sizeLabel,
      };

      nextQuantity = capLineQuantity(line, quantity);
      if (nextQuantity === line.quantity) {
        if (quantity > nextQuantity && line.maxQuantity != null && line.sizeLabel) {
          blockedNotice = rtwStockCapMessage(line.maxQuantity, line.sizeLabel);
        }
        return prev;
      }

      const lines = prev.lines.map((entry) =>
        entry.id === lineId
          ? {
              ...entry,
              quantity: nextQuantity,
              lineTotalMinor: entry.unitPriceMinor * nextQuantity,
            }
          : entry,
      );
      return { ...prev, lines, ...summarize(lines) };
    });

    if (blockedNotice) {
      setCartNotice(blockedNotice);
      return;
    }

    if (!isPersistedCartLineId(lineId)) {
      if (identity) {
        pendingLineOps.current.set(lineIdentityKey(identity), {
          quantity: nextQuantity,
        });
      }
      return;
    }

    startTransition(async () => {
      const result = await updateCartLineQuantity({
        lineId,
        quantity: nextQuantity,
      });
      if (result.ok) {
        setCart(result.cart);
        setCartNotice(null);
        return;
      }

      try {
        const fresh = await fetchCart();
        setCart(fresh);
      } catch {
        // Keep last known server-aligned cart if refresh fails.
      }
      setCartNotice(result.error);
    });
  }, []);

  const removeLine = useCallback((lineId: string) => {
    let identity: {
      designId: string;
      colourwayId: string;
      sizeMode: CartLinePublic["sizeMode"];
      sizeLabel: string | null;
    } | null = null;

    setCart((prev) => {
      const line = prev.lines.find((entry) => entry.id === lineId);
      if (line) {
        identity = {
          designId: line.designId,
          colourwayId: line.colourwayId,
          sizeMode: line.sizeMode,
          sizeLabel: line.sizeLabel,
        };
      }
      const lines = prev.lines.filter((l) => l.id !== lineId);
      return { ...prev, lines, ...summarize(lines) };
    });

    if (identity && !isPersistedCartLineId(lineId)) {
      pendingLineOps.current.set(lineIdentityKey(identity), {
        quantity: "remove",
      });
      return;
    }

    startTransition(async () => {
      const result = await removeCartLine({ lineId });
      if (result.ok) setCart(result.cart);
    });
  }, []);

  const value = useMemo(
    () => ({
      cart,
      drawerOpen,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      addItem,
      setLineQuantity,
      removeLine,
      clearBag,
      pending,
      bagHydrated,
      cartNotice,
      clearCartNotice,
      lastAddedName,
      clearLastAdded,
    }),
    [
      cart,
      drawerOpen,
      openDrawer,
      closeDrawer,
      toggleDrawer,
      addItem,
      setLineQuantity,
      removeLine,
      clearBag,
      pending,
      bagHydrated,
      cartNotice,
      clearCartNotice,
      lastAddedName,
      clearLastAdded,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}
