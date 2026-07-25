"use client";

import { useState } from "react";

import { Eyebrow } from "@/modules/ui";

type CompleteResponse = {
  asset: {
    id: string;
    sha256: string;
    bytes: number;
    width: number | null;
    height: number | null;
    r2Key: string;
  };
  readUrl: string;
};

export default function AssetsTestPage() {
  const [status, setStatus] = useState<string>("idle");
  const [result, setResult] = useState<CompleteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    setResult(null);
    setStatus("presigning");
    try {
      const presignRes = await fetch("/api/assets/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: file.type || "application/octet-stream" }),
      });
      if (!presignRes.ok) throw new Error(await presignRes.text());
      const { url, key } = (await presignRes.json()) as {
        url: string;
        key: string;
      };

      setStatus("uploading");
      const put = await fetch(url, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error(`upload failed: ${put.status}`);

      setStatus("completing");
      const completeRes = await fetch("/api/assets/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key,
          mime: file.type || "application/octet-stream",
        }),
      });
      if (!completeRes.ok) throw new Error(await completeRes.text());
      const data = (await completeRes.json()) as CompleteResponse;
      setResult(data);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-10 text-greige">
      <Eyebrow className="mb-2">Step 9</Eyebrow>
      <h1 className="font-display text-3xl">Asset upload test</h1>
      <p className="mt-2 text-sm text-chalk">
        Presigned upload → R2/MinIO → assets row → signed read URL.
      </p>

      <label className="mt-8 block border border-indigo-lift p-4">
        <span className="font-sans text-sm">Choose an image</span>
        <input
          type="file"
          accept="image/*"
          className="mt-3 block w-full font-sans text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
      </label>

      <p className="mt-4 font-data text-sm text-chalk">status: {status}</p>
      {error ? <p className="mt-2 text-sm text-madder">{error}</p> : null}

      {result ? (
        <div className="mt-6 space-y-3 border border-indigo-lift p-4">
          <p className="font-data text-xs break-all">sha256: {result.asset.sha256}</p>
          <p className="font-data text-xs">
            bytes: {result.asset.bytes} · {result.asset.width}×{result.asset.height}
          </p>
          <p className="font-data text-xs break-all">key: {result.asset.r2Key}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.readUrl}
            alt="Uploaded via signed URL"
            className="max-w-full border border-chalk"
          />
          <a
            href={result.readUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex border border-chalk px-3 py-2 font-sans text-sm text-greige"
          >
            Open signed URL
          </a>
        </div>
      ) : null}
    </main>
  );
}
