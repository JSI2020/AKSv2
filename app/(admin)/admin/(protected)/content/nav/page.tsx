import { Eyebrow } from "@/modules/ui";
import { requirePermission } from "@/modules/auth";
import { listNavItemsAdmin } from "@/modules/content/nav";
import { NavAdmin } from "@/modules/content/admin/nav-admin";

export default async function ContentNavPage() {
  await requirePermission("content.view");
  const rows = await listNavItemsAdmin();

  return (
    <div>
      <Eyebrow>Content</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">Navigation</h1>
      <NavAdmin
        initial={rows.map((r) => ({
          ...r,
          link: r.link as { type: string; value: string },
        }))}
      />
    </div>
  );
}
