"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";

import { useCan } from "@/modules/auth/use-can";
import { cn } from "@/lib/utils";

import { useVisibleNav } from "./admin-nav";

type AdminCommandMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AdminCommandMenu({ open, onOpenChange }: AdminCommandMenuProps) {
  const router = useRouter();
  const items = useVisibleNav();
  const canInvite = useCan("staff.create");
  const canStaff = useCan("staff.view");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/60 px-4 pt-[12vh]"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <Command
        className="w-full max-w-lg border border-chalk/40 bg-indigo text-greige"
        onClick={(e) => e.stopPropagation()}
        label="Command menu"
      >
        <Command.Input
          placeholder="Jump to…"
          className="w-full border-b border-indigo-lift bg-transparent px-3 py-3 font-sans text-[13px] text-greige outline-none placeholder:text-chalk"
        />
        <Command.List className="max-h-72 overflow-y-auto p-1">
          <Command.Empty className="px-3 py-4 text-[13px] text-chalk">
            No matches.
          </Command.Empty>
          <Command.Group
            heading="Navigate"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-sans [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-chalk"
          >
            {items.map((item) => (
              <Command.Item
                key={item.href}
                value={item.title}
                onSelect={() => go(item.href)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 px-2 py-1.5 text-[13px] aria-selected:bg-indigo-lift",
                )}
              >
                <item.icon className="size-3.5 text-chalk" aria-hidden />
                {item.title}
                {item.shortcut ? (
                  <span className="ms-auto font-data text-[10px] text-chalk">
                    {item.shortcut}
                  </span>
                ) : null}
              </Command.Item>
            ))}
          </Command.Group>
          {(canStaff || canInvite) && (
            <Command.Group
              heading="Staff"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-sans [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-chalk"
            >
              {canStaff ? (
                <Command.Item
                  value="Staff settings"
                  onSelect={() => go("/admin/settings/staff")}
                  className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-[13px] aria-selected:bg-indigo-lift"
                >
                  Staff
                </Command.Item>
              ) : null}
              {canInvite ? (
                <Command.Item
                  value="Invite staff"
                  onSelect={() => go("/admin/settings/staff?invite=1")}
                  className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-[13px] aria-selected:bg-indigo-lift"
                >
                  Invite staff
                </Command.Item>
              ) : null}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </div>
  );
}

export function useCommandMenuOpen() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
