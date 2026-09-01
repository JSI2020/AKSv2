"use client";

import { useState } from "react";

import { useRouter } from "@/i18n/routing";

/**
 * Storefront search input. Submits to /search?q=…; the page does the query.
 * Kept deliberately simple — one field, Enter or the button to run it.
 */
export function SearchBox({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  return (
    <form
      role="search"
      className="flex items-stretch gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
      }}
    >
      <input
        type="search"
        name="q"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search — a name, a code, kameez, blue…"
        aria-label="Search products"
        className="w-full border border-greige-deep bg-greige px-4 py-3 text-[15px] text-ink outline-none placeholder:text-ink/40 focus:border-ink"
      />
      <button
        type="submit"
        className="btn-primary shrink-0 px-6"
        aria-label="Search"
      >
        Search
      </button>
    </form>
  );
}
