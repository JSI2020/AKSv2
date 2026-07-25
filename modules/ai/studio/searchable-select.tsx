"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Command } from "cmdk";

import { cn } from "@/lib/utils";

export type SearchableOption = {
  value: string;
  label: string;
  hint?: string;
};

type SearchableSelectProps = {
  label: string;
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  inherited?: boolean;
  placeholder?: string;
  onAddNew?: () => void;
  addNewLabel?: string;
  disabled?: boolean;
};

export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  inherited = false,
  placeholder = "Search…",
  onAddNew,
  addNewLabel = "+ Add new",
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
        {label}
        {inherited ? (
          <span className="ms-1 normal-case tracking-normal text-chalk/70">
            inherited
          </span>
        ) : null}
      </span>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between border border-indigo-lift bg-indigo px-2 py-1.5 text-start text-[13px] text-greige outline-none focus:border-zari disabled:opacity-50",
          inherited && "opacity-60",
        )}
      >
        <span className="truncate">
          {selected?.label ?? placeholder}
          {selected?.hint ? (
            <span className="ms-1 text-chalk">· {selected.hint}</span>
          ) : null}
        </span>
        <span className="text-chalk" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={listId}
          className="absolute inset-bs-full z-20 mt-1 w-full border border-indigo-lift bg-indigo"
        >
          <Command label={label} className="text-greige">
            <Command.Input
              placeholder={placeholder}
              className="w-full border-b border-indigo-lift bg-transparent px-2 py-2 font-sans text-[13px] text-greige outline-none placeholder:text-chalk"
            />
            <Command.List className="max-h-48 overflow-y-auto p-1">
              <Command.Empty className="px-2 py-2 text-[12px] text-chalk">
                No matches.
              </Command.Empty>
              {options.map((opt) => (
                <Command.Item
                  key={opt.value}
                  value={`${opt.label} ${opt.hint ?? ""}`}
                  onSelect={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className="cursor-pointer px-2 py-1.5 text-[13px] aria-selected:bg-indigo-lift"
                >
                  {opt.label}
                  {opt.hint ? (
                    <span className="ms-1 text-chalk">· {opt.hint}</span>
                  ) : null}
                </Command.Item>
              ))}
              {onAddNew ? (
                <Command.Item
                  value="__add_new__"
                  onSelect={() => {
                    setOpen(false);
                    onAddNew();
                  }}
                  className="cursor-pointer border-t border-indigo-lift px-2 py-1.5 text-[13px] text-zari aria-selected:bg-indigo-lift"
                >
                  {addNewLabel}
                </Command.Item>
              ) : null}
            </Command.List>
          </Command>
        </div>
      ) : null}
    </div>
  );
}
