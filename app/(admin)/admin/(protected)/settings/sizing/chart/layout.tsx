import Link from "next/link";
import { requirePermission } from "@/modules/auth";
const links = [["Home", ""], ["Grid", "/grid"], ["Templates", "/templates"], ["Styles", "/styles"], ["Recognition", "/recognition"], ["Fit events", "/fit-events"]] as const;
export default async function DressSizingLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("settings.view");
  return <div className="space-y-5 text-[13px]">
    <nav className="flex flex-wrap gap-x-4 gap-y-2 border-b border-indigo-lift pb-3">
      {links.map(([label, suffix]) => <Link key={label} href={`/admin/settings/sizing/chart${suffix}`} className="text-chalk hover:text-greige">{label}</Link>)}
    </nav>
    {children}
  </div>;
}
