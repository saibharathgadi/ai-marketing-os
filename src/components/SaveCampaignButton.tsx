"use client"

import { useState } from "react"
import { Bookmark, BookmarkCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ToastProvider"

export default function SaveCampaignButton({
  auditId,
  siteUrl,
  name,
  objective,
  targetAudience,
  keyMessage,
  channels,
  onSaved
}: {
  auditId: string
  siteUrl: string
  name: string
  objective: string
  targetAudience: string
  keyMessage: string
  channels: string[]
  onSaved: (campaignId: string) => void
}) {

  const [state, setState] =
    useState<"idle" | "saving" | "saved" | "error">("idle")

  const { toast } = useToast()

  async function handleSave() {

    setState("saving")

    try {

      const response =
        await fetch("/api/campaigns", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            auditId,
            siteUrl,
            name,
            objective,
            targetAudience,
            keyMessage,
            channels
          })
        })

      const result = await response.json()

      if (result.success) {
        setState("saved")
        onSaved(result.data.id)
        toast({
          title: "Campaign saved",
          description: name,
          actionLabel: "View in Campaign Builder",
          actionHref: "/campaigns"
        })
      } else {
        setState("error")
      }

    } catch (error) {

      console.error(error)
      setState("error")

    }

  }

  return (

    <Button
      type="button"
      variant="default"
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
            : "Save Campaign"}
    </Button>

  )

}
