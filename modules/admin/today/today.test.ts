import { describe, expect, it } from "vitest";

import { resolvePermissions } from "@/modules/auth";

import {
  buildTodayActionCards,
  emptyTodayActionCounts,
  ownerPermissionSet,
} from "./action-cards";
import { endOfTodayInShop, getTodayScreenData, startOfTodayInShop } from "./queries";

describe("startOfTodayInShop", () => {
  it("returns midnight PKT for the shop calendar day", () => {
    const start = startOfTodayInShop(new Date("2026-07-25T20:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-07-25T19:00:00.000Z");
    expect(endOfTodayInShop(new Date("2026-07-25T20:00:00.000Z")).getTime()).toBe(
      start.getTime() + 24 * 60 * 60 * 1000 - 1,
    );
  });
});

describe("buildTodayActionCards", () => {
  it("hides order cards without orders.view", () => {
    const tailor = resolvePermissions({ role: "TAILOR" });
    const cards = buildTodayActionCards(tailor, {
      ...emptyTodayActionCounts(),
      bankTransfer: 2,
    });
    expect(cards.some((c) => c.id === "awaiting-confirmation")).toBe(false);
    expect(cards.some((c) => c.id === "bank-transfer")).toBe(false);
  });

  it("includes bank transfer card for accountant preset", () => {
    const accountant = resolvePermissions({ role: "ACCOUNTANT" });
    const cards = buildTodayActionCards(accountant, {
      ...emptyTodayActionCounts(),
      bankTransfer: 3,
      lowStock: 1,
      designsReview: 2,
    });
    expect(cards.find((c) => c.id === "bank-transfer")).toMatchObject({
      count: 3,
      href: "/admin/payments/verification",
    });
    expect(cards.find((c) => c.id === "low-stock")).toMatchObject({
      count: 1,
      href: "/admin/fabrics?lowStock=true",
    });
  });

  it("maps card hrefs to filtered list routes", () => {
    const cards = buildTodayActionCards(ownerPermissionSet(), {
      awaitingConfirmation: 1,
      measurementsUnverified: 2,
      atRisk: 3,
      balanceDue: 4,
      lowStock: 5,
      bankTransfer: 6,
      designsReview: 7,
    });
    const hrefById = Object.fromEntries(cards.map((c) => [c.id, c.href]));

    expect(hrefById["awaiting-confirmation"]).toBe(
      "/admin/orders?production=RECEIVED",
    );
    expect(hrefById["measurements-unverified"]).toBe(
      "/admin/orders?production=CONFIRMED",
    );
    expect(hrefById["at-risk"]).toBe("/admin/orders?atRisk=true");
    expect(hrefById["balance-due"]).toBe("/admin/orders?payment=BALANCE_DUE");
    expect(hrefById["low-stock"]).toBe("/admin/fabrics?lowStock=true");
    expect(hrefById["bank-transfer"]).toBe("/admin/payments/verification");
    expect(hrefById["designs-review"]).toBe(
      "/admin/designs?awaitingReview=true",
    );
  });
});

describe("getTodayScreenData", () => {
  it("returns no stats for tailor preset", async () => {
    const tailor = resolvePermissions({ role: "TAILOR" });
    const data = await getTodayScreenData(tailor);
    expect(data.stats).toBeNull();
    expect(data.cards).toEqual([]);
  });
});
