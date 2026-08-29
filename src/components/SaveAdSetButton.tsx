"use client"

import { useState } from "react"
import { Bookmark, BookmarkCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ToastProvider"

export default function SaveAdSetButton({
  campaignId,
  campaignName,
  audienceAngle,
  creativeAngle,
  suggestedBudgetSplit
}: {
  // null means the parent campaign hasn't been saved to Campaign Builder
  // yet in this session — ad sets require a real campaign_id foreign key,
  // so saving is gated on that happening first.
  campaignId: string | null
  campaignName: string
  audienceAngle: string
  creativeAngle: string
  suggestedBudgetSplit: string
}) {

  const [state, setState] =
    useState<"idle" | "saving" | "saved" | "error">("idle")

  const { toast } = useToast()

  async function handleSave() {

    if (!campaignId) return

    setState("saving")

    try {

      const response =
        await fetch("/api/ad-sets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            campaignId,
            audienceAngle,
            creativeAngle,
            suggestedBudgetSplit
          })
        })

      const result = await response.json()

      setState(result.success ? "saved" : "error")

      if (result.success) {
        toast({
          title: "Ad set saved",
          description: campaignName,
          actionLabel: "View in Campaign Builder",
          actionHref: "/campaigns"
        })
      }

    } catch (error) {

      console.error(error)
      setState("error")

    }

  }

  if (!campaignId) {
    return (
      <span className="text-xs text-muted-foreground">
        Save the &quot;{campaignName}&quot; campaign first
      </span>
    )
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
            : "Save Ad Set"}
    </Button>

  )

}
