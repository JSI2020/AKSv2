"use client";

import { useState, type ReactNode } from "react";

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

  return (
    <div className="admin-shell flex min-h-dvh bg-greige text-[14px] text-ink">
      <AdminSidebar email={email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader onOpenCommand={() => setCommandOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-20 pt-6 md:px-8 md:pb-10">
          {children}
        </main>
      </div>
      <AdminMobileNav />
      <AdminCommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
