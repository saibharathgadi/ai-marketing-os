import type { MetadataRoute } from "next"
import { blogPosts } from "@/content/blogPosts"

// Hardcoded rather than derived from an env var — no canonical-origin
// constant exists elsewhere in the app (everything else uses relative
// URLs / window.location.origin), and a sitemap is inherently tied to
// one specific production domain.
const baseUrl = "https://verolyx.in"

export default function sitemap(): MetadataRoute.Sitemap {

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${baseUrl}/blog`,
      changeFrequency: "weekly",
      priority: 0.8
    }
  ]

  const postRoutes: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.publishedAt,
    changeFrequency: "monthly",
    priority: 0.6
  }))

  return [...staticRoutes, ...postRoutes]

}
