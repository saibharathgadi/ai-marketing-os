"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { ContentItemType } from "@/utils/contentItems"

export default function SaveToContentStudioButton({
  auditId,
  siteUrl,
  type,
  title,
  body
}: {
  auditId: string
  siteUrl: string
  type: ContentItemType
  title: string
  body: Record<string, unknown>
}) {

  const [state, setState] =
    useState<"idle" | "saving" | "saved" | "error">("idle")

  async function handleSave() {

    setState("saving")

    try {

      const response =
        await fetch("/api/content-items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            auditId,
            siteUrl,
            type,
            title,
            body
          })
        })

      const result = await response.json()

      setState(result.success ? "saved" : "error")

    } catch (error) {

      console.error(error)
      setState("error")

    }

  }

  return (

    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={(e) => {
        e.stopPropagation()
        handleSave()
      }}
      disabled={state === "saving" || state === "saved"}
    >
      {state === "saved"
        ? "Saved ✓"
        : state === "saving"
          ? "Saving…"
          : state === "error"
            ? "Retry save"
            : "Save to Content Studio"}
    </Button>

  )

}
