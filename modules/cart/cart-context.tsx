"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import {
  addToCart,
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

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setDrawerOpen((v) => !v), []);

  const addItem = useCallback(
    async (input: AddToCartInput, designMeta: OptimisticMeta) => {
      const draft = optimisticLine(input, designMeta);
      const draftId = draft.id;

      setCart((prev) => mergeLineIntoCart(prev, draft));
      setDrawerOpen(true);

      const result = await addToCart(input);
      if (result.ok) {
        setCart(result.cart);
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
