// React 19 warns in dev when rendering produces a <script> tag. Setting
// type="text/javascript" on the server and "text/plain" on the client
// avoids the warning — the browser already executed the script during
// HTML parsing before hydration ever runs, so this has no effect on
// hard navigations, and correctly no-ops on client-side re-renders.
// See node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
