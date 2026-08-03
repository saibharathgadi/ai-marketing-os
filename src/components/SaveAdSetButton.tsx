"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

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
            : "Save Ad Set"}
    </Button>

  )

}
