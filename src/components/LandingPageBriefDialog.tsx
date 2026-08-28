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
  BRIEF_STATUSES,
  briefStatusLabels,
  type BriefStatus,
  type LandingPageBrief,
  type LandingPageBriefSection
} from "@/utils/campaigns"

export default function LandingPageBriefDialog({
  campaignId,
  brief,
  open,
  onOpenChange,
  onSaved,
  onDeleted
}: {
  campaignId: string
  // null = create mode
  brief: LandingPageBrief | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (brief: LandingPageBrief) => void
  onDeleted: (id: string) => void
}) {

  // Keyed by brief?.id (or the campaignId in create mode) so form state
  // always starts fresh — mirrors AdSetDialog/CampaignDialog.
  return (
    <LandingPageBriefDialogInner
      key={brief?.id ?? `new-${campaignId}`}
      campaignId={campaignId}
      brief={brief}
      open={open}
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      onDeleted={onDeleted}
    />
  )

}

function LandingPageBriefDialogInner({
  campaignId,
  brief,
  open,
  onOpenChange,
  onSaved,
  onDeleted
}: {
  campaignId: string
  brief: LandingPageBrief | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (brief: LandingPageBrief) => void
  onDeleted: (id: string) => void
}) {

  const isCreate = !brief

  const [title, setTitle] =
    useState(brief?.title ?? "")

  const [targetOffer, setTargetOffer] =
    useState(brief?.target_offer ?? "")

  const [sections, setSections] =
    useState<LandingPageBriefSection[]>(brief?.sections ?? [])

  const [status, setStatus] =
    useState<BriefStatus>(brief?.status ?? "draft")

  const [notes, setNotes] =
    useState(brief?.notes ?? "")

  const [generating, setGenerating] =
    useState(false)

  const [regenerating, setRegenerating] =
    useState(false)

  const [saving, setSaving] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  function updateSection(
    index: number,
    field: keyof LandingPageBriefSection,
    value: string
  ) {
    setSections((prev) =>
      prev.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, [field]: value } : section
      )
    )
  }

  async function handleGenerate() {

    setGenerating(true)
    setError(null)

    try {

      const response =
        await fetch("/api/landing-page-briefs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            campaignId,
            title,
            targetOffer
          })
        })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || "Failed to generate landing page brief.")
        return
      }

      onSaved(result.data)
      onOpenChange(false)

    } catch (err) {

      console.error(err)
      setError("Failed to generate landing page brief.")

    } finally {

      setGenerating(false)

    }

  }

  async function handleRegenerate() {

    if (!brief) return

    const confirmed =
      confirm(
        "Regenerate will replace all current sections and discard your edits. Continue?"
      )

    if (!confirmed) return

    setRegenerating(true)
    setError(null)

    try {

      const response =
        await fetch(`/api/landing-page-briefs/${brief.id}/regenerate`, {
          method: "POST"
        })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || "Failed to regenerate landing page brief.")
        return
      }

      setSections(result.data.sections)
      onSaved(result.data)

    } catch (err) {

      console.error(err)
      setError("Failed to regenerate landing page brief.")

    } finally {

      setRegenerating(false)

    }

  }

  async function handleSave() {

    if (!brief) return

    setSaving(true)
    setError(null)

    try {

      const response =
        await fetch(`/api/landing-page-briefs/${brief.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title,
            status,
            notes,
            sections
          })
        })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || "Failed to save landing page brief.")
        return
      }

      onSaved(result.data)
      onOpenChange(false)

    } catch (err) {

      console.error(err)
      setError("Failed to save landing page brief.")

    } finally {

      setSaving(false)

    }

  }

  async function handleDelete() {

    if (!brief) return

    const confirmed =
      confirm("Delete this landing page brief permanently?")

    if (!confirmed) return

    try {

      const response =
        await fetch(`/api/landing-page-briefs/${brief.id}`, {
          method: "DELETE"
        })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || "Failed to delete landing page brief.")
        return
      }

      onDeleted(brief.id)
      onOpenChange(false)

    } catch (err) {

      console.error(err)
      setError("Failed to delete landing page brief.")

    }

  }

  return (

    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent className="sm:max-w-2xl bg-background border border-border max-h-[85vh] overflow-y-auto">

        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isCreate ? "Generate Landing Page Brief" : "Edit Landing Page Brief"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">

          <div>
            <label className="text-xs text-muted-foreground">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Black Friday Landing Page"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Target Offer</label>
            <Textarea
              value={targetOffer}
              onChange={(e) => setTargetOffer(e.target.value)}
              placeholder="e.g. 20% off sitewide for Black Friday weekend"
              className="mt-1"
              rows={2}
              disabled={!isCreate}
            />
          </div>

          {isCreate ? (

            <p className="text-sm text-muted-foreground">
              Generating will create the brief using this campaign&apos;s context
              and your brand profile, if you&apos;ve saved one.
            </p>

          ) : (

            <>

              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Sections</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                >
                  {regenerating ? "Regenerating…" : "Regenerate"}
                </Button>
              </div>

              <div className="space-y-3">
                {sections.map((section, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-border bg-card p-3 space-y-2"
                  >

                    <Input
                      value={section.name}
                      onChange={(e) => updateSection(index, "name", e.target.value)}
                      placeholder="Section name"
                      className="font-medium"
                    />

                    <Input
                      value={section.purpose}
                      onChange={(e) => updateSection(index, "purpose", e.target.value)}
                      placeholder="Purpose"
                    />

                    <Input
                      value={section.copyHint}
                      onChange={(e) => updateSection(index, "copyHint", e.target.value)}
                      placeholder="Copy hint"
                    />

                    <Textarea
                      value={section.expandedCopy}
                      onChange={(e) =>
                        updateSection(index, "expandedCopy", e.target.value)
                      }
                      placeholder="Expanded copy direction"
                      rows={3}
                    />

                  </div>
                ))}
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {BRIEF_STATUSES.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={status === option ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatus(option)}
                    >
                      {briefStatusLabels[option]}
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
                  rows={3}
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
          {isCreate ? (
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? "Generating…" : "Generate Brief"}
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
        </DialogFooter>

      </DialogContent>

    </Dialog>

  )

}
