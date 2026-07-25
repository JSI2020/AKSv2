"use client";

import { useCallback, useState, useTransition } from "react";

import {
  adminClearTryOnCache,
  adminPurgeSelfie,
  adminRefreshDashboard,
  saveTryOnSettings,
} from "@/modules/tryon/actions";
import type {
  listPendingSelfies,
  TryOnAdminDashboardData,
} from "@/modules/tryon/queries";

type Props = {
  initial: TryOnAdminDashboardData;
  pendingSelfies: Awaited<ReturnType<typeof listPendingSelfies>>;
};

function formatUsdMicros(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(4)}`;
}

export function TryOnAdminDashboard({ initial, pendingSelfies }: Props) {
  const [data, setData] = useState(initial);
  const [selfies, setSelfies] = useState(pendingSelfies);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [cacheDesignId, setCacheDesignId] = useState("");

  const refresh = useCallback(() => {
    startTransition(async () => {
      const { dashboard, pendingSelfies: nextSelfies } =
        await adminRefreshDashboard();
      setData(dashboard);
      setSelfies(nextSelfies);
    });
  }, []);

  function handleSettingsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveTryOnSettings(formData);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Settings saved.");
      refresh();
    });
  }

  function handlePurge(selfieId: string) {
    startTransition(async () => {
      const result = await adminPurgeSelfie(selfieId);
      setMessage(result.ok ? "Selfie purged." : result.error ?? "Purge failed.");
      refresh();
    });
  }

  function handleClearCache() {
    if (!cacheDesignId.trim()) return;
    startTransition(async () => {
      const count = await adminClearTryOnCache(cacheDesignId.trim());
      setMessage(`Cleared ${count} cache entries for design.`);
      refresh();
    });
  }

  const capLabel =
    data.spend.capUsdMicros != null
      ? formatUsdMicros(data.spend.capUsdMicros)
      : "No cap";

  return (
    <div className="flex flex-col gap-8">
      {message ? (
        <p className="border border-zari/40 bg-indigo-lift px-3 py-2 text-[13px] text-greige">
          {message}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="border border-indigo-lift p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-chalk">
            Try-on spend (month)
          </p>
          <p className="mt-2 font-display text-2xl text-greige">
            {formatUsdMicros(data.spend.tryonUsdMicros)}
          </p>
        </div>
        <div className="border border-indigo-lift p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-chalk">
            Combined AI spend
          </p>
          <p className="mt-2 font-display text-2xl text-greige">
            {formatUsdMicros(data.spend.combinedUsdMicros)} / {capLabel}
          </p>
        </div>
        <div className="border border-indigo-lift p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-chalk">
            Conversion (try-on → cart)
          </p>
          <p className="mt-2 font-display text-2xl text-greige">
            {(data.conversionRate * 100).toFixed(1)}%
          </p>
        </div>
      </section>

      <form
        onSubmit={handleSettingsSubmit}
        className="flex max-w-xl flex-col gap-4 border border-indigo-lift p-4"
      >
        <legend className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Quota & model
        </legend>
        <label className="flex items-center gap-2 text-[13px] text-greige">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={data.settings.enabled}
            className="border border-indigo-lift"
          />
          Reflection enabled
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] text-greige">fal model id</span>
          <input
            name="modelId"
            defaultValue={data.settings.modelId}
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-greige">Anon daily limit</span>
            <input
              name="anonDailyLimit"
              type="number"
              min={1}
              defaultValue={data.settings.anonDailyLimit}
              className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-greige">Signed-in daily limit</span>
            <input
              name="signedInDailyLimit"
              type="number"
              min={1}
              defaultValue={data.settings.signedInDailyLimit}
              className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="self-start border border-zari bg-zari px-4 py-2 text-[13px] text-indigo"
        >
          Save settings
        </button>
      </form>

      <section className="border border-indigo-lift p-4">
        <h2 className="text-[11px] uppercase tracking-[0.12em] text-chalk">
          Purge job status
        </h2>
        <dl className="mt-3 grid gap-2 text-[13px] text-greige sm:grid-cols-3">
          <div>
            <dt className="text-chalk">Pending purge</dt>
            <dd>{data.purgeStatus.pendingCount}</dd>
          </div>
          <div>
            <dt className="text-chalk">Purged (24h)</dt>
            <dd>{data.purgeStatus.purgedLast24h}</dd>
          </div>
          <div>
            <dt className="text-chalk">Last purge</dt>
            <dd>
              {data.purgeStatus.lastPurgeAt
                ? data.purgeStatus.lastPurgeAt.toISOString()
                : "—"}
            </dd>
          </div>
        </dl>
        <ul className="mt-4 max-h-48 overflow-y-auto text-[12px] text-chalk">
          {selfies.map((s: { id: string; purgeAt: Date }) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-4 border-t border-indigo-lift py-2"
            >
              <span>
                {s.id.slice(0, 8)}… purge {s.purgeAt.toISOString()}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => handlePurge(s.id)}
                className="border border-madder px-2 py-1 text-madder"
              >
                Purge now
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="border border-indigo-lift p-4">
        <h2 className="text-[11px] uppercase tracking-[0.12em] text-chalk">
          Cache management
        </h2>
        <div className="mt-3 flex gap-2">
          <input
            value={cacheDesignId}
            onChange={(e) => setCacheDesignId(e.target.value)}
            placeholder="Design UUID"
            className="flex-1 border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          />
          <button
            type="button"
            disabled={pending}
            onClick={handleClearCache}
            className="border border-zari px-3 py-1.5 text-[13px] text-zari"
          >
            Clear cache
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] uppercase tracking-[0.12em] text-chalk">
          Recent sessions
        </h2>
        <div className="overflow-x-auto border border-indigo-lift">
          <table className="w-full min-w-[720px] text-left text-[12px] text-greige">
            <thead className="border-b border-indigo-lift text-chalk">
              <tr>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Cost</th>
                <th className="px-3 py-2">Cart</th>
                <th className="px-3 py-2">Identity</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((s) => (
                <tr key={s.id} className="border-b border-indigo-lift/60">
                  <td className="px-3 py-2">{s.createdAt.toISOString()}</td>
                  <td className="px-3 py-2">{s.status}</td>
                  <td className="px-3 py-2">
                    {s.costUsdMicros != null
                      ? formatUsdMicros(s.costUsdMicros)
                      : "—"}
                  </td>
                  <td className="px-3 py-2">{s.converted ? "Yes" : "—"}</td>
                  <td className="px-3 py-2">
                    {s.userEmail ?? s.anonId?.slice(0, 12) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] uppercase tracking-[0.12em] text-chalk">
          Consent records
        </h2>
        <div className="overflow-x-auto border border-indigo-lift">
          <table className="w-full min-w-[640px] text-left text-[12px] text-greige">
            <thead className="border-b border-indigo-lift text-chalk">
              <tr>
                <th className="px-3 py-2">Granted</th>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2">Revoked</th>
                <th className="px-3 py-2">Identity</th>
              </tr>
            </thead>
            <tbody>
              {data.consents.map((c) => (
                <tr key={c.id} className="border-b border-indigo-lift/60">
                  <td className="px-3 py-2">{c.grantedAt.toISOString()}</td>
                  <td className="px-3 py-2">v{c.version}</td>
                  <td className="px-3 py-2">
                    {c.revokedAt ? c.revokedAt.toISOString() : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {c.userEmail ?? c.anonId?.slice(0, 12) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
