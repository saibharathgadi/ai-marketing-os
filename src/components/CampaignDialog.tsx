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
  type Campaign,
  type CampaignStatus
} from "@/utils/campaigns"

export default function CampaignDialog({
  campaign,
  open,
  onOpenChange,
  onSaved,
  onDeleted
}: {
  // null = create mode
  campaign: Campaign | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (campaign: Campaign) => void
  onDeleted: (id: string) => void
}) {

  // Keying by campaign?.id (or a stable "new" key) fully remounts this
  // dialog whenever a different campaign is opened, or when switching to
  // create mode, so form state always starts fresh — no sync-on-prop-change
  // effect needed. Mirrors ContentItemDialog's pattern.
  return (
    <CampaignDialogInner
      key={campaign?.id ?? "new"}
      campaign={campaign}
      open={open}
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      onDeleted={onDeleted}
    />
  )

}

function CampaignDialogInner({
  campaign,
  open,
  onOpenChange,
  onSaved,
  onDeleted
}: {
  campaign: Campaign | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (campaign: Campaign) => void
  onDeleted: (id: string) => void
}) {

  const isCreate = !campaign

  const [name, setName] =
    useState(campaign?.name ?? "")

  const [objective, setObjective] =
    useState(campaign?.objective ?? "")

  const [targetAudience, setTargetAudience] =
    useState(campaign?.target_audience ?? "")

  const [keyMessage, setKeyMessage] =
    useState(campaign?.key_message ?? "")

  const [channelsText, setChannelsText] =
    useState((campaign?.channels ?? []).join(", "))

  const [status, setStatus] =
    useState<CampaignStatus>(campaign?.status ?? "draft")

  const [budget, setBudget] =
    useState(
      campaign?.budget !== null && campaign?.budget !== undefined
        ? String(campaign.budget)
        : ""
    )

  const [startDate, setStartDate] =
    useState(campaign?.start_date ?? "")

  const [endDate, setEndDate] =
    useState(campaign?.end_date ?? "")

  const [notes, setNotes] =
    useState(campaign?.notes ?? "")

  const [saving, setSaving] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  async function handleSave() {

    const trimmedName = name.trim()

    if (!trimmedName) {
      setError("Campaign name is required.")
      return
    }

    setSaving(true)
    setError(null)

    const channels =
      channelsText
        .split(",")
        .map((channel) => channel.trim())
        .filter(Boolean)

    const parsedBudget =
      budget.trim() === "" ? null : Number(budget)

    try {

      const url =
        isCreate
          ? "/api/campaigns"
          : `/api/campaigns/${campaign!.id}`

      const response =
        await fetch(url, {
          method: isCreate ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: trimmedName,
            objective,
            targetAudience,
            keyMessage,
            channels,
            ...(isCreate
              ? {}
              : {
                  status,
                  budget:
                    parsedBudget !== null &&
                    Number.isFinite(parsedBudget)
                      ? parsedBudget
                      : null,
                  startDate: startDate || null,
                  endDate: endDate || null,
                  notes
                })
          })
        })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || "Failed to save campaign.")
        return
      }

      onSaved(result.data)
      onOpenChange(false)

    } catch (err) {

      console.error(err)
      setError("Failed to save campaign.")

    } finally {

      setSaving(false)

    }

  }

  async function handleDelete() {

    if (!campaign) return

    const confirmed =
      confirm(
        "Delete this campaign and all of its ad sets permanently?"
      )

    if (!confirmed) return

    try {

      const response =
        await fetch(`/api/campaigns/${campaign.id}`, {
          method: "DELETE"
        })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || "Failed to delete campaign.")
        return
      }

      onDeleted(campaign.id)
      onOpenChange(false)

    } catch (err) {

      console.error(err)
      setError("Failed to delete campaign.")

    }

  }

  return (

    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent className="sm:max-w-lg bg-background border border-border max-h-[85vh] overflow-y-auto">

        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isCreate ? "New Campaign" : "Edit Campaign"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">

          <div>
            <label className="text-xs text-muted-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Objective</label>
            <Input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Target Audience</label>
            <Input
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Key Message</label>
            <Input
              value={keyMessage}
              onChange={(e) => setKeyMessage(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">
              Channels (comma-separated)
            </label>
            <Input
              value={channelsText}
              onChange={(e) => setChannelsText(e.target.value)}
              placeholder="Google Ads, LinkedIn, Meta"
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

              <div className="grid grid-cols-2 gap-3">

                <div>
                  <label className="text-xs text-muted-foreground">Budget</label>
                  <Input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>

              </div>

              <div className="grid grid-cols-2 gap-3">

                <div>
                  <label className="text-xs text-muted-foreground">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>

              </div>

              <div>
                <label className="text-xs text-muted-foreground">Notes</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Planning notes, launch checklist, anything else"
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
            {saving ? "Saving…" : isCreate ? "Create Campaign" : "Save"}
          </Button>
        </DialogFooter>

      </DialogContent>

    </Dialog>

  )

}
