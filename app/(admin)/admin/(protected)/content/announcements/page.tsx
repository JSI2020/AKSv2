import { redirect } from "next/navigation";

/** Announcements live under Create → Storefront → Ticker. */
export default function AnnouncementsRedirectPage() {
  redirect("/admin/settings/storefront?tab=ticker");
}
