import { Link } from "@/i18n/routing";

import type { DesignDetailPublic } from "./types";

export function DesignDetailBreadcrumb({
  design,
}: {
  design: DesignDetailPublic;
}) {
  return (
    <nav className="mb-7 text-[12px] tracking-[0.05em] text-ink/55">
      <Link href="/" className="text-ink/55">
        Home
      </Link>
      <span> / </span>
      <Link
        href={`/collections/${design.collectionBreadcrumb.slug}`}
        className="text-ink/55"
      >
        {design.collectionBreadcrumb.label}
      </Link>
      <span> / </span>
      <span>{design.name}</span>
    </nav>
  );
}
