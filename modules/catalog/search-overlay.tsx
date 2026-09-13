"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "@/i18n/routing";
import { formatMoney } from "@/modules/ui/money/money";

import { POPULAR_SEARCH_TERMS, SEARCH_HINT } from "./search-suggestions";

type ProductHit = {
  id: string;
  slug: string;
  name: string;
  garmentType: string;
  priceMinor: number;
  compareAtMinor: number | null;
  thumbnailUrl: string | null;
};

type SearchResponse = {
  q: string;
  total: number;
  products: ProductHit[];
};

const RECENT_KEY = "aks:recent-searches";
const RECENT_MAX = 5;
const DEBOUNCE_MS = 220;
const MIN_CHARS = 2;

type NavItem =
  | { kind: "product"; index: number; product: ProductHit }
  | { kind: "see-all" };

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function pushRecent(term: string): string[] {
  const t = term.trim();
  if (!t) return readRecent();
  const next = [t, ...readRecent().filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(
    0,
    RECENT_MAX,
  );
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);

  const query = value.trim();
  const showResults = query.length >= MIN_CHARS;

  useEffect(() => {
    if (!open) return;
    setRecent(readRecent());
    setActiveIdx(-1);
    setError(null);
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (query.length < MIN_CHARS) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error("Search failed");
        const json = (await res.json()) as SearchResponse;
        setData(json);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError("Could not search right now. Try again.");
          setData(null);
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  const products = useMemo(() => data?.products ?? [], [data]);

  const navItems = useMemo((): NavItem[] => {
    const items: NavItem[] = products.map((p, index) => ({
      kind: "product",
      index,
      product: p,
    }));
    if (products.length > 0) items.push({ kind: "see-all" });
    return items;
  }, [products]);

  const goToResults = useCallback(
    (term: string) => {
      const t = term.trim();
      if (!t) return;
      setRecent(pushRecent(t));
      onClose();
      router.push(`/search?q=${encodeURIComponent(t)}`);
    },
    [onClose, router],
  );

  const goToProduct = useCallback(
    (p: ProductHit) => {
      setRecent(pushRecent(query || p.name));
      onClose();
      router.push(`/designs/${p.slug}`);
    },
    [onClose, router, query],
  );

  const activateNav = useCallback(
    (item: NavItem | undefined) => {
      if (!item) return;
      if (item.kind === "product") goToProduct(item.product);
      else goToResults(query);
    },
    [goToProduct, goToResults, query],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "Tab" && panelRef.current) {
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, input, a, [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (!showResults || navItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, navItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      activateNav(navItems[activeIdx >= 0 ? activeIdx : 0]);
    }
  };

  if (!open) return null;

  const seeAllActive =
    activeIdx >= 0 && navItems[activeIdx]?.kind === "see-all";

  return (
    <div
      className="search-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="search-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-dialog-title"
        onKeyDown={onKeyDown}
      >
        <p id="search-dialog-title" className="sr-only">
          Search the collection
        </p>
        <form
          className="search-inputrow"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            goToResults(query);
          }}
        >
          <svg className="search-inputicon" viewBox="0 0 24 24" aria-hidden="true">
            <use href="#ic-search" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setActiveIdx(-1);
            }}
            placeholder="Search pieces, shades, fabrics…"
            aria-label="Search products"
            aria-controls="search-results"
            aria-expanded={showResults}
            aria-activedescendant={
              activeIdx >= 0 ? `search-option-${activeIdx}` : undefined
            }
            className="search-input"
            autoComplete="off"
            enterKeyHint="search"
          />
          {value ? (
            <button
              type="button"
              className="search-clear"
              onClick={() => {
                setValue("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          ) : null}
          <button
            type="button"
            className="search-close"
            onClick={onClose}
            aria-label="Close search"
          >
            Close
          </button>
        </form>

        <div className="search-body" id="search-results">
          {!showResults ? (
            <div className="search-suggests">
              <p className="search-kbd-hint">
                Tip: press <kbd>/</kbd> anywhere to open search
              </p>
              {recent.length > 0 ? (
                <section>
                  <h3 className="search-h">Recent</h3>
                  <div className="search-chips">
                    {recent.map((r) => (
                      <button
                        key={r}
                        type="button"
                        className="search-chip"
                        onClick={() => goToResults(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
              <section>
                <h3 className="search-h">Popular</h3>
                <div className="search-chips">
                  {POPULAR_SEARCH_TERMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="search-chip"
                      onClick={() => goToResults(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          ) : loading && !data ? (
            <p className="search-status" aria-live="polite">
              Searching…
            </p>
          ) : error ? (
            <div className="search-empty">
              <p className="search-status">{error}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="search-empty">
              <p className="search-status">Nothing matched “{query}”.</p>
              <p className="search-hint">{SEARCH_HINT}</p>
              <div className="search-chips mt-4 px-2">
                {POPULAR_SEARCH_TERMS.slice(0, 4).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="search-chip"
                    onClick={() => goToResults(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <ul className="search-hits" role="listbox" aria-label="Search results">
                {products.map((p, i) => {
                  const active = i === activeIdx;
                  return (
                    <li
                      key={p.id}
                      id={`search-option-${i}`}
                      role="option"
                      aria-selected={active}
                    >
                      <button
                        type="button"
                        className={`search-hit${active ? " on" : ""}`}
                        onMouseEnter={() => setActiveIdx(i)}
                        onClick={() => goToProduct(p)}
                      >
                        <span className="search-thumb">
                          {p.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.thumbnailUrl} alt="" loading="lazy" />
                          ) : (
                            <span className="search-thumb-ph" />
                          )}
                        </span>
                        <span className="search-hit-text">
                          <span className="search-hit-name">{p.name}</span>
                          <span className="search-hit-meta">{p.garmentType}</span>
                        </span>
                        <span className="search-hit-price">
                          {formatMoney(p.priceMinor, "PKR")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                id={`search-option-${products.length}`}
                className={`search-seeall${seeAllActive ? " on" : ""}`}
                onMouseEnter={() => setActiveIdx(products.length)}
                onClick={() => goToResults(query)}
              >
                See all {data?.total ?? products.length} result
                {(data?.total ?? 0) === 1 ? "" : "s"} for “{query}”
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
