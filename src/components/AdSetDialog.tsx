"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  CAMPAIGN_STATUSES,
  campaignStatusLabels,
  type AdSet,
  type CampaignStatus
} from "@/utils/campaigns"

export default function AdSetDialog({
  campaignId,
  adSet,
  open,
  onOpenChange,
  onSaved,
  onDeleted
}: {
  campaignId: string
  // null = create mode
  adSet: AdSet | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (adSet: AdSet) => void
  onDeleted: (id: string) => void
}) {

  // Keyed by adSet?.id (or the campaignId in create mode) so form state
  // always starts fresh — mirrors CampaignDialog/ContentItemDialog.
  return (
    <AdSetDialogInner
      key={adSet?.id ?? `new-${campaignId}`}
      campaignId={campaignId}
      adSet={adSet}
      open={open}
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      onDeleted={onDeleted}
    />
  )

}

function AdSetDialogInner({
  campaignId,
  adSet,
  open,
  onOpenChange,
  onSaved,
  onDeleted
}: {
  campaignId: string
  adSet: AdSet | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (adSet: AdSet) => void
  onDeleted: (id: string) => void
}) {

  const isCreate = !adSet

  const [audienceAngle, setAudienceAngle] =
    useState(adSet?.audience_angle ?? "")

  const [creativeAngle, setCreativeAngle] =
    useState(adSet?.creative_angle ?? "")

  const [suggestedBudgetSplit, setSuggestedBudgetSplit] =
    useState(adSet?.suggested_budget_split ?? "")

  const [status, setStatus] =
    useState<CampaignStatus>(adSet?.status ?? "draft")

  const [notes, setNotes] =
    useState(adSet?.notes ?? "")

  const [saving, setSaving] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  async function handleSave() {

    setSaving(true)
    setError(null)

    try {

      const url =
        isCreate
          ? "/api/ad-sets"
          : `/api/ad-sets/${adSet!.id}`

      const response =
        await fetch(url, {
          method: isCreate ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ...(isCreate ? { campaignId } : {}),
            audienceAngle,
            creativeAngle,
            suggestedBudgetSplit,
            ...(isCreate ? {} : { status, notes })
          })
        })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || "Failed to save ad set.")
        return
      }

      onSaved(result.data)
      onOpenChange(false)

    } catch (err) {

      console.error(err)
      setError("Failed to save ad set.")

    } finally {

      setSaving(false)

    }

  }

  async function handleDelete() {

    if (!adSet) return

    const confirmed =
      confirm("Delete this ad set permanently?")

    if (!confirmed) return

    try {

      const response =
        await fetch(`/api/ad-sets/${adSet.id}`, {
          method: "DELETE"
        })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || "Failed to delete ad set.")
        return
      }

      onDeleted(adSet.id)
      onOpenChange(false)

    } catch (err) {

      console.error(err)
      setError("Failed to delete ad set.")

    }

  }

  return (

    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent className="sm:max-w-lg bg-background border border-border max-h-[85vh] overflow-y-auto">

        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isCreate ? "New Ad Set" : "Edit Ad Set"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">

          <div>
            <label className="text-xs text-muted-foreground">Audience Angle</label>
            <Textarea
              value={audienceAngle}
              onChange={(e) => setAudienceAngle(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Creative Angle</label>
            <Textarea
              value={creativeAngle}
              onChange={(e) => setCreativeAngle(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">
              Suggested Budget Split
            </label>
            <Input
              value={suggestedBudgetSplit}
              onChange={(e) => setSuggestedBudgetSplit(e.target.value)}
              placeholder="e.g. 40% Search / 60% Social"
              className="mt-1"
            />
          </div>

          {!isCreate && (

            <>

              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {CAMPAIGN_STATUSES.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={status === option ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatus(option)}
                    >
                      {campaignStatusLabels[option]}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Notes</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1"
                  rows={4}
                />
              </div>

            </>

          )}

        </div>

        {error && (
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        )}

        <DialogFooter>
          {!isCreate && (
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isCreate ? "Create Ad Set" : "Save"}
          </Button>
        </DialogFooter>

      </DialogContent>

    </Dialog>

  )

}
