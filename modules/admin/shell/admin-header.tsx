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
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-indigo-lift bg-indigo px-4 py-2.5">
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex flex-wrap items-center gap-1.5 font-sans text-[12px] text-chalk">
          {crumbs.map((c, i) => (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 ? <span aria-hidden className="text-chalk/50">/</span> : null}
              {c.href && i < crumbs.length - 1 ? (
                <Link
                  href={c.href}
                  className="truncate text-chalk hover:text-greige"
                >
                  {c.label}
                </Link>
              ) : (
                <span className="truncate text-greige">{c.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <button
        type="button"
        onClick={onOpenCommand}
        className="shrink-0 border border-indigo-lift px-2 py-1 font-sans text-[11px] text-chalk hover:border-chalk hover:text-greige"
      >
        <span className="hidden sm:inline">Search </span>
        <kbd className="font-data text-greige">⌘K</kbd>
      </button>
    </header>
  );
}
