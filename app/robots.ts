import type { MetadataRoute } from "next";
import { SITE_URL, IS_STAGING } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      ...(IS_STAGING ? { disallow: "/" } : { allow: "/" }),
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
