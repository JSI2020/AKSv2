import { redirect } from "next/navigation";

/** Studio hub merged into Designs catalogue. */
export default function StudioRedirectPage() {
  redirect("/admin/designs");
}
