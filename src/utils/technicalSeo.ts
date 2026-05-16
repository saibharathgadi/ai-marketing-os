export async function analyzeTechnicalSeo(
  html: string,
  baseUrl: string
) {
  const origin = new URL(baseUrl).origin

  const technicalSeo = {

    robotsTxt: false,

    sitemap: false,

    canonical: false,

    openGraph: false,

    twitterCards: false,

    schemaMarkup: false

  }

  try {

    const robotsResponse =
      await fetch(
        `${origin}/robots.txt`
      )

    technicalSeo.robotsTxt =
      robotsResponse.ok

  } catch {}

  try {

    const sitemapResponse =
      await fetch(
        `${origin}/sitemap.xml`
      )

    technicalSeo.sitemap =
      sitemapResponse.ok

  } catch {}

  try {

    technicalSeo.canonical =
      /<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/i.test(
        html
      )

  } catch {}

  try {

    technicalSeo.openGraph =
      /<meta\b[^>]*property=["']og:/i.test(
        html
      )

  } catch {}

  try {

    technicalSeo.twitterCards =
      /<meta\b[^>]*name=["']twitter:/i.test(
        html
      )

  } catch {}

  try {

    technicalSeo.schemaMarkup =
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>/i.test(
        html
      )

  } catch {}

  return technicalSeo

}
