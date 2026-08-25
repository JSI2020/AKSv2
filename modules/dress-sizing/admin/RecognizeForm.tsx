"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { recognizeFromUrl } from "./actions";
export function RecognizeForm() {
  const router = useRouter(); const [url, setUrl] = useState(""); const [error, setError] = useState("");
  return <form className="border border-indigo-lift p-4" onSubmit={async (e) => {
    e.preventDefault(); setError("");
    try { const result = await recognizeFromUrl(url); router.push(`/admin/settings/sizing/chart/recognition/${result.proposalId}`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Recognition failed"); }
  }}>
    <h2 className="font-display text-xl text-greige">Recognize from URL</h2>
    <input className="mt-3 w-full border border-chalk/40 bg-indigo p-2 text-[12px] text-greige" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" required />
    <button className="mt-3 bg-zari px-3 py-1.5 text-[12px] text-ink">Recognize</button>
    {error ? <p className="mt-2 text-[12px] text-madder">{error}</p> : null}
  </form>;
}
