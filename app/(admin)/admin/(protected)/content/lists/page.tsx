import { Eyebrow } from "@/modules/ui";
import { requirePermission } from "@/modules/auth";
import { getContentList } from "@/modules/content/pages";
import { ListsAdmin } from "@/modules/content/admin/lists-admin";

export default async function ContentListsPage() {
  await requirePermission("content.view");
  const items = await getContentList("CONSTRUCTION");

  return (
    <div>
      <Eyebrow>Content</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">Lists</h1>
      <p className="mt-2 text-[13px] text-chalk">
        Construction principles shown in the Atelier / making section.
      </p>
      <ListsAdmin listKey="CONSTRUCTION" initial={items} />
    </div>
  );
}
