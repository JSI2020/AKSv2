import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/modules/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account",
        "/account/",
        "/cart",
        "/cart/",
        "/bag",
        "/bag/",
        "/checkout",
        "/checkout/",
        "/admin",
        "/admin/",
        "/api/",
        "/track/",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/").replace(/\/$/, ""),
  };
}
