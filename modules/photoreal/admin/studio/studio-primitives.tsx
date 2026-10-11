"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LayoutGrid, Settings2, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type StudioTabId = "photograph" | "create" | "fabric" | "sizing";

/** Studio tools, named for the job — the two main tools first. */
const STUDIO_TABS: Array<{ id: StudioTabId; label: string }> = [
  { id: "photograph", label: "Photograph a dress" },
  { id: "create", label: "Create a look" },
  { id: "fabric", label: "Fabric shot" },
  { id: "sizing", label: "Size chart" },
];

export type StudioQuality = "standard" | "high";

type ToastContextValue = {
  toast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function StudioToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string) => {
    setMessage(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(null), 2200);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {message && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 bg-ink px-4 py-2.5 text-[13px] text-milk rounded-[2px]"
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useStudioToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useStudioToast requires StudioToastProvider");
  return ctx.toast;
}

export function StudioShell({
  tab,
  onTabChange,
  subtitle,
  onOpenSettings,
  quality,
  onQualityChange,
  children,
}: {
  tab: StudioTabId;
  onTabChange: (tab: StudioTabId) => void;
  subtitle: ReactNode;
  onOpenSettings: () => void;
  /** Image model tier — Standard, or High detail at about twice the cost. */
  quality?: StudioQuality;
  onQualityChange?: (quality: StudioQuality) => void;
  children: ReactNode;
}) {
  return (
    <div className="text-greige">
      <header className="mb-8">
        <p className="mb-6 text-[10px] font-semibold uppercase tracking-[0.24em] text-chalk">
          AI Studio
        </p>

        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 border-b border-indigo-lift pb-0">
          <div
            className="-mx-1 flex max-w-full items-end gap-7 overflow-x-auto px-1 [scrollbar-width:none] sm:gap-10"
            role="tablist"
            aria-label="Studio tools"
          >
            {STUDIO_TABS.map((item) => {
              const selected = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "group relative -mb-px shrink-0 whitespace-nowrap pb-4 pt-0.5 text-start transition-colors",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zari",
                  )}
                >
                  <span
                    className={cn(
                      "font-display text-[21px] leading-[1.05] tracking-[0.01em] sm:text-[26px]",
                      selected
                        ? "text-ink"
                        : "text-ink/50 group-hover:text-ink/80",
                    )}
                  >
                    {item.label}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-inline-start-0 inset-inline-end-0 -bottom-px block h-px origin-left transition-transform duration-200",
                      selected ? "scale-x-100 bg-zari" : "scale-x-0 bg-transparent",
                    )}
                  />
                </button>
              );
            })}
          </div>

          <nav className="mb-4 flex flex-wrap items-center gap-x-7 gap-y-3">
            {quality && onQualityChange && (
              <div
                role="radiogroup"
                aria-label="Image quality"
                className="inline-flex items-center border border-ink/20 text-[11px] rounded-[2px]"
              >
                {(
                  [
                    ["standard", "Standard"],
                    ["high", "High detail · 2×"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={quality === value}
                    onClick={() => onQualityChange(value)}
                    className={cn(
                      "px-2.5 py-1 font-semibold tracking-[0.04em] transition-colors",
                      quality === value
                        ? "bg-ink text-milk"
                        : "text-ink/65 hover:text-ink",
                    )}
                    title={
                      value === "high"
                        ? "Sharper embroidery and fine detail — about twice the cost per photo"
                        : "Fast and economical — good for most catalogue shots"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <Link
              href="/admin/photoreal/gallery"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-chalk transition hover:text-greige"
            >
              <LayoutGrid className="size-3.5 stroke-[1.5]" />
              Gallery
            </Link>
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-chalk transition hover:text-greige"
            >
              <Settings2 className="size-3.5 stroke-[1.5]" />
              Settings
            </button>
          </nav>
        </div>

        <p className="mt-6 max-w-[44rem] text-[13.5px] leading-[1.6] text-ink/70">
          {subtitle}
        </p>
      </header>
      {children}
    </div>
  );
}

export function Workbench({
  input,
  output,
}: {
  input: ReactNode;
  output: ReactNode;
}) {
  return (
    <div className="mb-16 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20">
      <div>{input}</div>
      <div className="lg:border-s lg:border-indigo-lift lg:ps-16 xl:ps-20">
        {output}
      </div>
    </div>
  );
}

export function PanelHead({
  label,
  step,
}: {
  label: string;
  step: string;
}) {
  return (
    <div className="mb-6 flex items-baseline justify-between border-b border-indigo-lift pb-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-chalk">
        {label}
      </span>
      <span className="font-mono text-[10px] tracking-[0.08em] text-chalk/60">
        {step}
      </span>
    </div>
  );
}

/** Section divider — thin rule, editorial label. No boxed fieldsets. */
export function StudioSection({
  title,
  children,
  className,
  first,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  first?: boolean;
}) {
  return (
    <section
      className={cn(
        "border-t border-indigo-lift pt-7",
        first && "border-t-0 pt-0",
        className,
      )}
    >
      <h3 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.24em] text-chalk">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function EmptyOutput({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex min-h-[480px] flex-col items-center justify-center border border-indigo-lift bg-indigo-lift/15 px-8 py-12 text-center rounded-[2px]">
      <p className="font-display text-[22px] leading-snug text-greige/90">
        {title}
      </p>
      <p className="mt-3 max-w-[22rem] text-[12.5px] leading-relaxed text-chalk">
        {subtitle}
      </p>
    </div>
  );
}

export function StudioDropzone({
  label,
  sublabel,
  slim,
  disabled,
  dragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onChoose,
  inputRef,
  onFileChange,
  multiple,
}: {
  label: string;
  sublabel: string;
  slim?: boolean;
  disabled?: boolean;
  dragOver?: boolean;
  onDragEnter?: () => void;
  onDragLeave?: () => void;
  onDrop?: (files: FileList) => void;
  onChoose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (files: FileList) => void;
  multiple?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onChoose}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChoose();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragEnter?.();
      }}
      onDragLeave={() => onDragLeave?.()}
      onDrop={(e) => {
        e.preventDefault();
        onDragLeave?.();
        if (e.dataTransfer.files.length) onDrop?.(e.dataTransfer.files);
      }}
      className={cn(
        "cursor-pointer border border-dashed border-ink/25 bg-milk/70 text-center transition-colors rounded-[2px] hover:border-zari hover:bg-milk",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zari",
        slim ? "px-3 py-3" : "px-6 py-9",
        dragOver && "border-zari bg-milk",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <p className={cn("text-ink", slim ? "text-[12.5px]" : "text-[14px]")}>
        {label}
      </p>
      <p className="mt-1 text-[11.5px] text-ink/60">{sublabel}</p>
      <button
        type="button"
        tabIndex={-1}
        className="mt-3 border-b border-zari pb-0.5 text-[12px] font-semibold text-ink"
        onClick={(e) => {
          e.stopPropagation();
          onChoose();
        }}
      >
        Choose {multiple ? "files" : "file"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFileChange(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export type ThumbAsset = {
  localPreview: string;
  name: string;
};

export function ThumbRow({
  assets,
  onRemove,
  onMakeMain,
}: {
  assets: ThumbAsset[];
  onRemove: (index: number) => void;
  /**
   * When set, the first thumbnail is badged "Main" and clicking another one
   * makes it the main photo (multi-photo garment references).
   */
  onMakeMain?: (index: number) => void;
}) {
  if (!assets.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {assets.map((asset, i) => (
        <div
          key={`${asset.localPreview}-${i}`}
          className={cn(
            "relative size-14 overflow-hidden border rounded-[2px]",
            onMakeMain && i === 0 ? "border-zari" : "border-indigo-lift",
          )}
        >
          {onMakeMain && i > 0 ? (
            <button
              type="button"
              className="size-full"
              title="Make this the main photo"
              aria-label={`Make ${asset.name} the main photo`}
              onClick={() => onMakeMain(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.localPreview}
                alt={asset.name}
                className="size-full object-cover"
              />
            </button>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.localPreview}
              alt={asset.name}
              className="size-full object-cover"
            />
          )}
          {onMakeMain && i === 0 && (
            <span className="absolute inset-x-0 bottom-0 bg-zari/90 py-px text-center text-[8.5px] font-semibold uppercase tracking-[0.12em] text-indigo">
              Main
            </span>
          )}
          <button
            type="button"
            aria-label="Remove"
            className="absolute inset-block-start-0.5 inset-inline-end-0.5 flex size-4 items-center justify-center bg-ink/80 text-greige rounded-[2px]"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(i);
            }}
          >
            <X className="size-2.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export const studioFieldClass =
  "w-full border border-indigo-lift bg-indigo px-3 py-2 text-[13px] text-greige rounded-[2px] outline-none transition-colors focus:border-zari";

export const studioLabelClass =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-chalk";

export const studioHintClass = "mt-1.5 text-[11.5px] leading-snug text-ink/60";

/** Main call-to-action — clearly different when it can't be pressed yet. */
export const studioPrimaryButtonClass =
  "min-w-[9rem] rounded-[2px] border border-zari bg-zari px-5 py-2 text-[13px] font-semibold text-indigo hover:bg-zari/90 disabled:border-ink/20 disabled:bg-transparent disabled:text-ink/40 disabled:opacity-100";
