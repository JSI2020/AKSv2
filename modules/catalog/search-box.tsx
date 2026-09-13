"use client";

import { useEffect, useState } from "react";
import { useQueryStates } from "nuqs";

import { useRouter } from "@/i18n/routing";

import { collectionFilterParsers } from "./search-params";

/**
 * Storefront search input. On /search syncs q via nuqs; elsewhere submits to /search?q=….
 */
export function SearchBox({
  initialQuery = "",
  syncUrl = false,
}: {
  initialQuery?: string;
  /** When true, typing updates ?q= on the search page (Enter still works). */
  syncUrl?: boolean;
}) {
  const router = useRouter();
  const [params, setParams] = useQueryStates(collectionFilterParsers, {
    history: "push",
    shallow: false,
  });
  const [value, setValue] = useState(syncUrl ? params.q : initialQuery);
  const [focusOnMount, setFocusOnMount] = useState(false);

  useEffect(() => {
    if (syncUrl) setValue(params.q);
    else setValue(initialQuery);
  }, [syncUrl, params.q, initialQuery]);

  useEffect(() => {
    if (!syncUrl) return;
    const q = value.trim();
    if (q === params.q.trim()) return;
    if (q.length === 1) return;
    const t = setTimeout(() => {
      void setParams({ q, page: 1 });
    }, 400);
    return () => clearTimeout(t);
  }, [value, syncUrl, params.q, setParams]);

  useEffect(() => {
    const coarse =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches;
    setFocusOnMount(!coarse);
  }, []);

  function submit(next?: string) {
    const q = (next ?? value).trim();
    if (syncUrl) {
      void setParams({ q, page: 1 });
      return;
    }
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <form
      role="search"
      className="search-page-form flex items-stretch gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <span className="search-page-inputwrap flex min-w-0 flex-1 items-center gap-2">
        <svg
          className="search-inputicon ms-3 shrink-0"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <use href="#ic-search" />
        </svg>
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          name="q"
          autoFocus={focusOnMount}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (syncUrl && e.target.value.trim().length === 0) {
              void setParams({ q: "", page: 1 });
            }
          }}
          placeholder="Name, code, kameez, ivory, oyster…"
          aria-label="Search products"
          className="search-page-input min-w-0 flex-1"
          autoComplete="off"
        />
        {value ? (
          <button
            type="button"
            className="search-clear me-1"
            onClick={() => {
              setValue("");
              if (syncUrl) void setParams({ q: "", page: 1 });
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        ) : null}
      </span>
      <button type="submit" className="btn-primary search-page-submit" aria-label="Search">
        Search
      </button>
    </form>
  );
}
