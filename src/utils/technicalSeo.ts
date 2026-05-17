async function checkUrl(url: string) {
  for (const method of ["HEAD", "GET"]) {
    const controller =
      new AbortController()

    const timeout =
      setTimeout(
        () => controller.abort(),
        5000
      )

    try {
      const response =
        await fetch(url, {
          method,
          redirect: "follow",
          signal: controller.signal
        })

      if (
        response.ok ||
        response.status !== 405 ||
        method === "GET"
      ) {
        return response.ok
      }
    } catch {
      return false
    } finally {
      clearTimeout(timeout)
    }
  }

  return false
}

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

    technicalSeo.robotsTxt =
      await checkUrl(`${origin}/robots.txt`)

  } catch {}

  try {

    technicalSeo.sitemap =
      await checkUrl(`${origin}/sitemap.xml`)

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
