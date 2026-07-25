import Link from "next/link";
import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { listSizeBlocks } from "@/modules/sizing/block-actions";

export default async function SizeBlocksPage() {
  let blocks;
  try {
    blocks = await listSizeBlocks();
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Settings · Sizing</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">
          Size blocks
        </h1>
        <p className="mt-1 max-w-xl text-[13px] text-chalk">
          Standard charts. Unpinned cells are computed from base + grade
          steps — never stored.
        </p>
      </div>

      <div className="border border-indigo-lift">
        <div className="border-b border-indigo-lift px-3 py-2">
          <p className="font-sans text-[12px] uppercase tracking-[0.12em] text-chalk">
            Blocks · {blocks.length}
          </p>
        </div>
        <ul className="divide-y divide-indigo-lift">
          {blocks.map((b) => (
            <li key={b.id}>
              <Link
                href={`/admin/settings/sizing/blocks/${b.id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 hover:bg-indigo-lift/40"
              >
                <div>
                  <p className="text-[13px] text-greige">{b.name}</p>
                  <p className="font-data text-[11px] text-chalk">
                    {b.categoryKey} · base {b.baseSizeLabel} ·{" "}
                    {b.sizeLabels.join(" ")}
                  </p>
                </div>
                <p className="font-sans text-[11px] uppercase tracking-[0.08em] text-chalk">
                  {b.isDefault ? "Default" : "Custom"}
                  {b.active ? "" : " · inactive"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
