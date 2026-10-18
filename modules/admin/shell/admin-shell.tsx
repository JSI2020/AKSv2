"use client";

import { useCallback, useState, type ReactNode } from "react";

import { AdminCommandMenu } from "./admin-command-menu";
import { AdminHeader } from "./admin-header";
import { AdminMobileNav, AdminSidebar } from "./admin-nav";

type AdminShellProps = {
  email?: string | null;
  children: ReactNode;
};

/**
 * Admin shell — indigo rail + warm greige content ground
 * (docs/AKS_Admin_Redesign.html). Six brand colours only.
 */
export function AdminShell({ email, children }: AdminShellProps) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <div className="admin-shell flex min-h-dvh max-w-[100vw] bg-greige text-[14px] text-ink">
      <AdminSidebar email={email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader
          onOpenCommand={() => setCommandOpen(true)}
          onOpenMenu={() => setMenuOpen(true)}
        />
        <main className="mx-auto w-full min-w-0 max-w-[1400px] flex-1 px-4 pb-8 pt-4 md:px-8 md:pb-10 md:pt-6">
          {children}
        </main>
      </div>
      <AdminMobileNav open={menuOpen} onClose={closeMenu} />
      <AdminCommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
