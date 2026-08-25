"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { breadcrumbForPath } from "../nav-config";

export function AdminHeader({
  onOpenCommand,
}: {
  onOpenCommand: () => void;
}) {
  const pathname = usePathname();
  const crumbs = breadcrumbForPath(pathname);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink/10 bg-greige/90 px-4 py-3 backdrop-blur-md md:px-8">
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex flex-wrap items-center gap-1.5 font-sans text-[12px] tracking-[0.06em] text-ink/55">
          {crumbs.map((c, i) => (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 ? <span aria-hidden className="text-ink/30">/</span> : null}
              {c.href && i < crumbs.length - 1 ? (
                <Link
                  href={c.href}
                  className="truncate text-ink/55 hover:text-ink"
                >
                  {c.label}
                </Link>
              ) : (
                <span className="truncate font-normal text-ink">{c.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <button
        type="button"
        onClick={onOpenCommand}
        className="flex shrink-0 items-center gap-2 border border-ink/12 bg-milk px-3 py-1.5 font-sans text-[12.5px] text-ink/55 hover:border-ink/30 hover:text-ink"
      >
        <span className="hidden sm:inline">Search</span>
        <kbd className="ms-auto font-data text-[10px] opacity-60">⌘K</kbd>
      </button>
    </header>
  );
}
