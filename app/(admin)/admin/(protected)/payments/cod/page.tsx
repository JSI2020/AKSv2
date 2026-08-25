import { redirect } from "next/navigation";

export default function CodRedirectPage() {
  redirect("/admin/finance?tab=cod");
}
