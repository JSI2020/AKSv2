import { redirect } from "next/navigation";

/** Studio new design merged into Designs editor pipeline. */
export default function StudioNewRedirectPage() {
  redirect("/admin/designs/new");
}
