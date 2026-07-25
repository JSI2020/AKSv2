"use client";

import { useState, type ReactNode } from "react";

import { AdminCommandMenu } from "./admin-command-menu";
import { AdminHeader } from "./admin-header";
import { AdminMobileNav, AdminSidebar } from "./admin-nav";

type AdminShellProps = {
  email?: string | null;
  children: ReactNode;
};

export function AdminShell({ email, children }: AdminShellProps) {
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <div className="flex min-h-dvh bg-indigo text-[13px] text-greige">
      <AdminSidebar email={email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader onOpenCommand={() => setCommandOpen(true)} />
        <main className="flex-1 px-4 pb-20 pt-4 md:px-6 md:pb-6">{children}</main>
      </div>
      <AdminMobileNav />
      <AdminCommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
