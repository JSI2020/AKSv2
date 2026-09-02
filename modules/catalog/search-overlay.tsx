"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "@/i18n/routing";
import { formatMoney } from "@/modules/ui/money/money";

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
const POPULAR = ["Kameez", "Trouser", "Dupatta", "Gown", "Ivory", "Black"];
const DEBOUNCE_MS = 200;
const MIN_CHARS = 2;

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
    /* private mode — ignore */
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
  const [value, setValue] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);

  const query = value.trim();
  const showResults = query.length >= MIN_CHARS;

  // Focus and lock scroll while open; restore recents each open.
  useEffect(() => {
    if (!open) return;
    setRecent(readRecent());
    setActiveIdx(-1);
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Debounced fetch.
  useEffect(() => {
    if (!open) return;
    if (query.length < MIN_CHARS) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        const json = (await res.json()) as SearchResponse;
        setData(json);
      } catch {
        /* aborted or failed */
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

  // Keyboard: Esc closes; ↑/↓ move through hits; Enter opens the hit or results.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (!showResults) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, products.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && products[activeIdx]) goToProduct(products[activeIdx]);
      else goToResults(query);
    }
  };

  if (!open) return null;

  return (
    <div
      className="search-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="search-panel" role="search">
        <form
          className="search-inputrow"
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
            onKeyDown={onKeyDown}
            placeholder="Search for a piece, a colour, a garment…"
            aria-label="Search products"
            aria-expanded={showResults}
            className="search-input"
            autoComplete="off"
          />
          {value ? (
            <button
              type="button"
              className="search-clear"
              onClick={() => {
                setValue("");
                inputRef.current?.focus();
              }}
              aria-label="Clear"
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

        <div className="search-body">
          {!showResults ? (
            <div className="search-suggests">
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
                  {POPULAR.map((p) => (
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
            <p className="search-status">Searching…</p>
          ) : products.length === 0 ? (
            <div className="search-empty">
              <p className="search-status">
                Nothing matched “{query}”.
              </p>
              <p className="search-hint">
                Try a name, an item code, a garment like “kameez”, or a colour.
              </p>
            </div>
          ) : (
            <>
              <ul className="search-hits" role="listbox">
                {products.map((p, i) => (
                  <li key={p.id} role="option" aria-selected={i === activeIdx}>
                    <button
                      type="button"
                      className={`search-hit${i === activeIdx ? " on" : ""}`}
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
                ))}
              </ul>
              <button
                type="button"
                className="search-seeall"
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
