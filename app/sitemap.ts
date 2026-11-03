import { buildSitemap } from "@/modules/seo/sitemap-data";

export const dynamic = "force-dynamic";

export default function sitemap() {
  return buildSitemap();
}
