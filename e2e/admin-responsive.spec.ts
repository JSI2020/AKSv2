import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ARTIFACTS = "/opt/cursor/artifacts/admin-mobile";

const VIEWPORTS = [
  { name: "iphone-se-portrait", width: 375, height: 667 },
  { name: "iphone-se-landscape", width: 667, height: 375 },
  { name: "iphone-15-portrait", width: 390, height: 844 },
  { name: "iphone-15-landscape", width: 844, height: 390 },
  { name: "iphone-pro-max-portrait", width: 430, height: 932 },
  { name: "iphone-pro-max-landscape", width: 932, height: 430 },
  { name: "pixel-7-portrait", width: 412, height: 915 },
  { name: "pixel-7-landscape", width: 915, height: 412 },
  { name: "galaxy-s-portrait", width: 360, height: 800 },
  { name: "galaxy-s-landscape", width: 800, height: 360 },
  { name: "ipad-mini-portrait", width: 768, height: 1024 },
  { name: "ipad-mini-landscape", width: 1024, height: 768 },
  { name: "ipad-pro-portrait", width: 1024, height: 1366 },
  { name: "ipad-pro-landscape", width: 1366, height: 1024 },
  { name: "desktop-1280-landscape", width: 1280, height: 800 },
  { name: "desktop-1280-portrait", width: 800, height: 1280 },
  { name: "desktop-1920-landscape", width: 1920, height: 1080 },
  { name: "desktop-1920-portrait", width: 1080, height: 1920 },
] as const;

const KEY_PAGES: { name: string; path: string }[] = [
  { name: "overview", path: "/admin" },
  { name: "orders", path: "/admin/orders" },
  { name: "order-detail", path: "/admin/orders/01a15066-0000-7000-8000-0000000000e1" },
  { name: "designs", path: "/admin/designs" },
  { name: "design-editor", path: "/admin/designs/01a15066-0000-7000-8000-0000000000d1" },
  { name: "inventory", path: "/admin/inventory" },
  { name: "finance", path: "/admin/finance" },
  { name: "settings", path: "/admin/settings" },
];

const CRAWL = [
  "/admin",
  "/admin/orders",
  "/admin/orders/01a15066-0000-7000-8000-0000000000e1",
  "/admin/customers",
  "/admin/discounts",
  "/admin/content",
  "/admin/content/homepage",
  "/admin/content/nav",
  "/admin/content/pages",
  "/admin/content/announcements",
  "/admin/production",
  "/admin/inventory",
  "/admin/fabrics",
  "/admin/photoreal",
  "/admin/designs",
  "/admin/designs/new",
  "/admin/designs/01a15066-0000-7000-8000-0000000000d1",
  "/admin/designs/publish-gaps",
  "/admin/tryon",
  "/admin/finance",
  "/admin/insights",
  "/admin/settings",
  "/admin/settings/audit",
  "/admin/settings/whatsapp",
  "/admin/settings/staff",
  "/admin/settings/roles",
  "/admin/settings/storefront",
  "/en",
  "/en/collections",
  "/en/bag",
];

const MENU_LABELS = [
  "Overview",
  "Orders",
  "Customers",
  "Discounts",
  "Content & Settings",
  "Production",
  "Inventory",
  "Fabric",
  "AI Studio",
  "Designs",
  "AI Spend",
  "Payments & Finance",
  "Insights",
  "Settings",
  "Audit log",
  "WhatsApp",
];

type Audit = { pageOverflow: number; clipped: string[] };

async function audit(page: Page): Promise<Audit> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const pageOverflow = root.scrollWidth - root.clientWidth;
    const clipped: string[] = [];
    const nodes = document.querySelectorAll(
      "a, button, input, select, textarea, [role='tab']",
    );
    for (const node of nodes) {
      const el = node as HTMLElement;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (el.closest("[data-open='false'], [aria-hidden='true']")) continue;
      let insideScroll = false;
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        const parentStyle = getComputedStyle(parent);
        const scrolls =
          parentStyle.overflowX === "auto" || parentStyle.overflowX === "scroll";
        if (scrolls && parent.scrollWidth > parent.clientWidth + 1) {
          insideScroll = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (insideScroll) continue;
      if (rect.right > root.clientWidth + 2 || rect.left < -2) {
        const label = (
          el.getAttribute("aria-label") ||
          el.textContent ||
          el.tagName
        )
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 60);
        clipped.push(`${el.tagName.toLowerCase()} ${label}`);
      }
    }
    return { pageOverflow, clipped: clipped.slice(0, 8) };
  });
}

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("owner@aks.test");
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/otp/request") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send code" }).click();
  const body = (await (await responsePromise).json()) as {
    devCode?: string;
    error?: string;
  };
  expect(body.devCode, body.error ?? "dev OTP missing").toMatch(/^\d{6}$/);
  await page.getByLabel("One-time code").fill(body.devCode!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 30_000 });
}

test.describe.configure({ timeout: 300_000 });

test.beforeAll(async ({ browser }) => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const page = await browser.newPage();
  await signIn(page);
  await page.context().storageState({ path: "/tmp/aks-admin-auth.json" });
  await page.close();
});

for (const viewport of VIEWPORTS) {
  test(viewport.name, async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "/tmp/aks-admin-auth.json",
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    const dir = path.join(ARTIFACTS, viewport.name);
    fs.mkdirSync(dir, { recursive: true });
    const problems: string[] = [];

    if (viewport.width < 1024) {
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Open menu" }).click();
      const menu = page.getByRole("dialog", { name: "Admin menu" });
      for (const label of MENU_LABELS) {
        await expect(menu.getByRole("link", { name: label, exact: true })).toBeVisible();
      }
      await page.screenshot({ path: path.join(dir, "menu.png"), fullPage: false });
      await page.getByRole("button", { name: "Close menu" }).click();
    }

    for (const entry of KEY_PAGES) {
      const response = await page.goto(entry.path, { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 0, entry.path).toBeLessThan(400);
      await page.screenshot({
        path: path.join(dir, `${entry.name}.png`),
        fullPage: false,
      });
      const result = await audit(page);
      if (result.pageOverflow > 1 || result.clipped.length > 0) {
        problems.push(
          `${entry.path} overflow=${result.pageOverflow} clipped=${result.clipped.join(" | ")}`,
        );
      }
    }

    if (viewport.width < 1024) {
      await page.goto(KEY_PAGES[4]!.path, { waitUntil: "load" });
      const photos = page.getByRole("tab", { name: /Photos/ });
      const upload = page.getByText("Add photo").or(page.getByText("Drop a photo"));
      await expect(async () => {
        await photos.click();
        await expect(photos).toHaveAttribute("aria-selected", "true");
        await expect(upload.first()).toBeVisible();
      }).toPass({ timeout: 15_000 });
    }

    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: path.join(dir, "storefront.png"), fullPage: false });
    const shop = await audit(page);
    if (shop.pageOverflow > 1 || shop.clipped.length > 0) {
      problems.push(
        `/en overflow=${shop.pageOverflow} clipped=${shop.clipped.join(" | ")}`,
      );
    }

    for (const route of CRAWL) {
      const response = await page.goto(route, { waitUntil: "load" });
      const status = response?.status() ?? 0;
      if (status >= 400) {
        problems.push(`${route} status=${status}`);
        continue;
      }
      const result = await audit(page);
      if (result.pageOverflow > 1 || result.clipped.length > 0) {
        problems.push(
          `${route} overflow=${result.pageOverflow} clipped=${result.clipped.join(" | ")}`,
        );
      }
    }

    expect(problems, problems.join("\n")).toEqual([]);
    await context.close();
  });
}
