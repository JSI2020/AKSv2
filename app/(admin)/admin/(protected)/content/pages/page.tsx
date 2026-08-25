import Link from "next/link";

import { Eyebrow } from "@/modules/ui";
import { requirePermission } from "@/modules/auth";
import { listContentPagesAdmin } from "@/modules/content/pages";
import { PagesAdmin } from "@/modules/content/admin/pages-admin";

export default async function ContentPagesPage() {
  await requirePermission("content.view");
  const pages = await listContentPagesAdmin();

  return (
    <div>
      <Link
        href="/admin/content"
        className="font-sans text-[12px] text-ink/55 hover:text-zari"
      >
        ← Content & Settings
      </Link>
      <Eyebrow className="mt-4 text-ink/55">Content · Pages</Eyebrow>
      <h1 className="mt-1 font-display text-3xl font-light text-ink">
        Content pages
      </h1>
      <p className="mt-2 text-[13px] text-ink/55">
        The copy that isn&apos;t a product — edited here, not in code.
      </p>
      <PagesAdmin
        initial={pages.map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          body: p.body,
          status: p.status,
          updatedAt: p.updatedAt,
        }))}
      />
    </div>
  );
}
