import { redirect } from "next/navigation";

export default function VerificationRedirectPage() {
  redirect("/admin/finance?tab=verify");
}
