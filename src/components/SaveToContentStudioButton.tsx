"use client"

import { useState } from "react"
import { Bookmark, BookmarkCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ToastProvider"
import type { ContentItemType } from "@/utils/contentItems"

export default function SaveToContentStudioButton({
  auditId,
  siteUrl,
  type,
  title,
  body,
  variant = "outline"
}: {
  auditId: string
  siteUrl: string
  type: ContentItemType
  title: string
  body: Record<string, unknown>
  variant?: "outline" | "ghost"
}) {

  const [state, setState] =
    useState<"idle" | "saving" | "saved" | "error">("idle")

  const { toast } = useToast()

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

      if (result.success) {
        toast({
          title: "Saved to Content Studio",
          description: title,
          actionLabel: "View in Content Studio",
          actionHref: "/content"
        })
      }

    } catch (error) {

      console.error(error)
      setState("error")

    }

  }

  return (

    <Button
      type="button"
      variant={variant}
      size="xs"
      onClick={(e) => {
        e.stopPropagation()
        handleSave()
      }}
      disabled={state === "saving" || state === "saved"}
    >
      {state === "saved" ? (
        <BookmarkCheck />
      ) : (
        <Bookmark />
      )}
      {state === "saved"
        ? "Saved"
        : state === "saving"
          ? "Saving…"
          : state === "error"
            ? "Retry save"
            : "Save to Content Studio"}
    </Button>

  )

}
