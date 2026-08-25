"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import {
  addToCart,
  fetchCart,
  removeCartLine,
  updateCartLineQuantity,
} from "./actions";
import type { AddToCartInput, CartLinePublic, CartPublic } from "./types";

type OptimisticMeta = {
  designSlug: string;
  designName: string;
  colourwayName: string;
  unitPriceMinor: number;
  thumbnailUrl: string | null;
  leadTimeDays: number | null;
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
  pending: boolean;
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
    unitPriceMinor: designMeta.unitPriceMinor,
    lineTotalMinor: designMeta.unitPriceMinor * input.quantity,
    thumbnailUrl: designMeta.thumbnailUrl,
    leadTimeDays: designMeta.leadTimeDays,
  };
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
          ? {
              ...l,
              quantity: l.quantity + line.quantity,
              lineTotalMinor: l.unitPriceMinor * (l.quantity + line.quantity),
            }
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
  const [lastAddedName, setLastAddedName] = useState<string | null>(null);
  const drawerOpenRef = useRef(drawerOpen);
  drawerOpenRef.current = drawerOpen;

  // Keep client cart aligned when the server layout re-hydrates (e.g. after consolidate).
  const serverStamp = `${initialCart.id}:${initialCart.lines
    .map((l) => `${l.id}:${l.quantity}`)
    .join(",")}`;
  const [seenStamp, setSeenStamp] = useState(serverStamp);
  if (serverStamp !== seenStamp) {
    setSeenStamp(serverStamp);
    setCart(initialCart);
  }

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

  const addItem = useCallback(
    async (input: AddToCartInput, designMeta: OptimisticMeta) => {
      const draft = optimisticLine(input, designMeta);
      const draftId = draft.id;

      setCart((prev) => mergeLineIntoCart(prev, draft));
      setDrawerOpen(true);

      const result = await addToCart(input);
      if (result.ok) {
        setCart(result.cart);
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
    setCart((prev) => {
      const lines = prev.lines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              quantity,
              lineTotalMinor: line.unitPriceMinor * quantity,
            }
          : line,
      );
      return { ...prev, lines, ...summarize(lines) };
    });

    startTransition(async () => {
      const result = await updateCartLineQuantity({ lineId, quantity });
      if (result.ok) setCart(result.cart);
    });
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setCart((prev) => {
      const lines = prev.lines.filter((l) => l.id !== lineId);
      return { ...prev, lines, ...summarize(lines) };
    });

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
      pending,
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
      pending,
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
