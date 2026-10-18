"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { breadcrumbForPath } from "../nav-config";

export function AdminHeader({
  onOpenCommand,
  onOpenMenu,
}: {
  onOpenCommand: () => void;
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();
  const crumbs = breadcrumbForPath(pathname);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-ink/10 bg-greige/95 px-3 py-2 backdrop-blur-md md:px-8 md:py-3">
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          onClick={onOpenMenu}
          className="inline-flex size-11 shrink-0 items-center justify-center border border-ink/15 bg-milk text-ink lg:hidden"
          aria-label="Open menu"
        >
          <span aria-hidden className="text-lg leading-none">
            ☰
          </span>
        </button>
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex flex-wrap items-center gap-1.5 font-sans text-[12px] tracking-[0.06em] text-ink/55">
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
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
      </div>
      <button
        type="button"
        onClick={onOpenCommand}
        className="inline-flex h-11 shrink-0 items-center gap-2 border border-ink/12 bg-milk px-3 font-sans text-[12.5px] text-ink/55 hover:border-ink/30 hover:text-ink"
        aria-label="Search"
      >
        <span className="hidden sm:inline">Search</span>
        <kbd className="font-data text-[10px] opacity-60">⌘K</kbd>
      </button>
    </header>
  );
}
