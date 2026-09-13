/**
 * Live prepaid balances from fal.ai and DeepSeek — for the Money · AI spend page.
 * Keys stay in env; we never store wallet amounts in our DB.
 */

export type ProviderBalanceOk = {
  ok: true;
  provider: "fal" | "deepseek";
  label: string;
  currency: string;
  /** Display amount in major units (USD/CNY). */
  balance: number;
  /** Optional breakdown for DeepSeek. */
  granted?: number;
  toppedUp?: number;
  available?: boolean;
  username?: string;
  fetchedAt: string;
};

export type ProviderBalanceErr = {
  ok: false;
  provider: "fal" | "deepseek";
  label: string;
  error: string;
  /** Hint for ops (e.g. missing admin key). */
  hint?: string;
  fetchedAt: string;
};

export type ProviderBalance = ProviderBalanceOk | ProviderBalanceErr;

export type ProviderBalancesSnapshot = {
  fal: ProviderBalance;
  deepseek: ProviderBalance;
};

const FAL_BILLING_URL = "https://api.fal.ai/v1/account/billing?expand=credits";

function nowIso(): string {
  return new Date().toISOString();
}

function falAuthKey(): string | null {
  return (
    process.env.FAL_ADMIN_KEY?.trim() ||
    process.env.FAL_KEY?.trim() ||
    null
  );
}

export function parseFalBillingJson(
  body: unknown,
): { balance: number; currency: string; username?: string } | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Unexpected fal billing response." };
  }
  const o = body as Record<string, unknown>;
  const credits = o.credits;
  if (!credits || typeof credits !== "object") {
    return {
      error:
        "fal response had no credits — use an Admin API key (FAL_ADMIN_KEY) with expand=credits.",
    };
  }
  const c = credits as Record<string, unknown>;
  const balance = Number(c.current_balance);
  const currency = String(c.currency ?? "USD");
  if (!Number.isFinite(balance) || balance < 0) {
    return { error: "fal credits.current_balance missing or invalid." };
  }
  return {
    balance,
    currency,
    username: typeof o.username === "string" ? o.username : undefined,
  };
}

export async function fetchFalAccountBalance(): Promise<ProviderBalance> {
  const fetchedAt = nowIso();
  const label = "fal.ai";
  const key = falAuthKey();
  if (!key) {
    return {
      ok: false,
      provider: "fal",
      label,
      error: "FAL_KEY is not set.",
      hint: "Add FAL_KEY (and ideally FAL_ADMIN_KEY for billing) in .env.local.",
      fetchedAt,
    };
  }

  try {
    const res = await fetch(FAL_BILLING_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Key ${key}`,
      },
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const msg =
        (json &&
          typeof json === "object" &&
          (json as { error?: { message?: string } }).error?.message) ||
        text.slice(0, 200) ||
        res.statusText;
      const needsAdmin =
        res.status === 401 ||
        res.status === 403 ||
        /admin/i.test(String(msg));
      return {
        ok: false,
        provider: "fal",
        label,
        error: `fal billing HTTP ${res.status}: ${msg}`,
        hint: needsAdmin
          ? "Billing needs an Admin API key from fal.ai → Dashboard → API Keys. Set FAL_ADMIN_KEY."
          : undefined,
        fetchedAt,
      };
    }

    const parsed = parseFalBillingJson(json);
    if ("error" in parsed) {
      return {
        ok: false,
        provider: "fal",
        label,
        error: parsed.error,
        hint: "Create an Admin key at fal.ai and set FAL_ADMIN_KEY in .env.local.",
        fetchedAt,
      };
    }

    return {
      ok: true,
      provider: "fal",
      label,
      currency: parsed.currency,
      balance: parsed.balance,
      username: parsed.username,
      fetchedAt,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "fal",
      label,
      error: e instanceof Error ? e.message : "fal billing request failed",
      fetchedAt,
    };
  }
}

export function parseDeepseekBalanceJson(
  body: unknown,
):
  | {
      balance: number;
      currency: string;
      granted: number;
      toppedUp: number;
      available: boolean;
    }
  | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Unexpected DeepSeek balance response." };
  }
  const o = body as Record<string, unknown>;
  const available = Boolean(o.is_available);
  const infos = o.balance_infos;
  if (!Array.isArray(infos) || infos.length < 1) {
    return { error: "DeepSeek returned no balance_infos." };
  }

  const preferUsd = infos.find(
    (row) =>
      row &&
      typeof row === "object" &&
      String((row as { currency?: string }).currency).toUpperCase() === "USD",
  );
  const row = (preferUsd ?? infos[0]) as Record<string, unknown>;
  const currency = String(row.currency ?? "USD");
  const balance = Number.parseFloat(String(row.total_balance ?? "NaN"));
  const granted = Number.parseFloat(String(row.granted_balance ?? "0"));
  const toppedUp = Number.parseFloat(String(row.topped_up_balance ?? "0"));
  if (!Number.isFinite(balance)) {
    return { error: "DeepSeek total_balance missing or invalid." };
  }
  return {
    balance,
    currency,
    granted: Number.isFinite(granted) ? granted : 0,
    toppedUp: Number.isFinite(toppedUp) ? toppedUp : 0,
    available,
  };
}

export async function fetchDeepseekAccountBalance(): Promise<ProviderBalance> {
  const fetchedAt = nowIso();
  const label = "DeepSeek";
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) {
    return {
      ok: false,
      provider: "deepseek",
      label,
      error: "DEEPSEEK_API_KEY is not set.",
      hint: "Add DEEPSEEK_API_KEY in .env.local to show prepaid balance here.",
      fetchedAt,
    };
  }

  const base =
    process.env.DEEPSEEK_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://api.deepseek.com";

  try {
    const res = await fetch(`${base}/user/balance`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      return {
        ok: false,
        provider: "deepseek",
        label,
        error: `DeepSeek balance HTTP ${res.status}: ${text.slice(0, 200) || res.statusText}`,
        fetchedAt,
      };
    }

    const parsed = parseDeepseekBalanceJson(json);
    if ("error" in parsed) {
      return {
        ok: false,
        provider: "deepseek",
        label,
        error: parsed.error,
        fetchedAt,
      };
    }

    return {
      ok: true,
      provider: "deepseek",
      label,
      currency: parsed.currency,
      balance: parsed.balance,
      granted: parsed.granted,
      toppedUp: parsed.toppedUp,
      available: parsed.available,
      fetchedAt,
    };
  } catch (e) {
    return {
      ok: false,
      provider: "deepseek",
      label,
      error: e instanceof Error ? e.message : "DeepSeek balance request failed",
      fetchedAt,
    };
  }
}

/** Fetch both wallets in parallel for the AI spend dashboard. */
export async function fetchProviderBalances(): Promise<ProviderBalancesSnapshot> {
  const [fal, deepseek] = await Promise.all([
    fetchFalAccountBalance(),
    fetchDeepseekAccountBalance(),
  ]);
  return { fal, deepseek };
}
