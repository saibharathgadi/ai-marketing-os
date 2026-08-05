import type { MetadataRoute } from "next"

const baseUrl = "https://verolyx.in"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/content",
        "/campaigns",
        "/audit",
        "/login"
      ]
    },
    sitemap: `${baseUrl}/sitemap.xml`
  }
}
