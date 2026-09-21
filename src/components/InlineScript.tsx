// React 19 warns in dev when rendering produces a <script> tag. Setting
// a different type on the server than on the client avoids the warning
// and, for behavioral scripts, stops the browser re-running it on
// hydration (it already ran during HTML parsing, before hydration).
// `type` lets non-executable scripts (e.g. JSON-LD structured data)
// keep their real server-rendered type for crawlers, since it's the
// static HTML they read, not the post-hydration client DOM.
// See node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
export function InlineScript({
  html,
  type = "text/javascript"
}: {
  html: string
  type?: string
}) {
  return (
    <script
      type={typeof window === "undefined" ? type : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
