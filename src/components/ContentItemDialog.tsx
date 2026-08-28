"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  contentItemTypeLabels,
  type ContentItem,
  type ContentItemStatus,
  type CreativeVariation
} from "@/utils/contentItems"

const statusOptions: { value: ContentItemStatus; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "drafted", label: "Drafted" },
  { value: "published", label: "Published" }
]

function renderBody(item: ContentItem) {
  const body = item.body || {}

  switch (item.type) {

    case "blog_series": {
      const posts =
        Array.isArray(body.posts) ? body.posts as { title: string; angle: string }[] : []

      return (
        <div className="space-y-2">
          {typeof body.description === "string" && (
            <p className="text-sm text-muted-foreground">{body.description}</p>
          )}
          <ol className="list-decimal list-inside space-y-1 text-sm text-foreground">
            {posts.map((post, index) => (
              <li key={index}>
                <span className="font-medium">{post.title}</span>
                {post.angle && (
                  <span className="text-muted-foreground"> — {post.angle}</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )
    }

    case "social_series": {
      const posts =
        Array.isArray(body.posts) ? body.posts as { hook: string; caption: string }[] : []

      return (
        <div className="space-y-2">
          {typeof body.platform === "string" && (
            <Badge variant="outline">{body.platform}</Badge>
          )}
          <ul className="space-y-2 text-sm text-foreground">
            {posts.map((post, index) => (
              <li key={index}>
                <p className="font-medium">{post.hook}</p>
                {post.caption && (
                  <p className="text-muted-foreground mt-1">{post.caption}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )
    }

    case "social_idea":
      return (
        <div className="space-y-2 text-sm text-foreground">
          {typeof body.platform === "string" && (
            <Badge variant="outline">{body.platform}</Badge>
          )}
          {typeof body.idea === "string" && <p>{body.idea}</p>}
        </div>
      )

    case "ad_campaign":
      return (
        <div className="space-y-1 text-sm text-foreground">
          {typeof body.objective === "string" && (
            <p><span className="text-muted-foreground">Objective:</span> {body.objective}</p>
          )}
          {typeof body.targetAudience === "string" && (
            <p><span className="text-muted-foreground">Audience:</span> {body.targetAudience}</p>
          )}
          {typeof body.keyMessage === "string" && (
            <p><span className="text-muted-foreground">Key message:</span> {body.keyMessage}</p>
          )}
          {Array.isArray(body.channels) && (
            <p><span className="text-muted-foreground">Channels:</span> {(body.channels as string[]).join(", ")}</p>
          )}
        </div>
      )

    case "ad_set":
      return (
        <div className="space-y-1 text-sm text-foreground">
          {typeof body.audienceAngle === "string" && (
            <p><span className="text-muted-foreground">Audience angle:</span> {body.audienceAngle}</p>
          )}
          {typeof body.creativeAngle === "string" && (
            <p><span className="text-muted-foreground">Creative angle:</span> {body.creativeAngle}</p>
          )}
          {typeof body.suggestedBudgetSplit === "string" && (
            <p><span className="text-muted-foreground">Budget split:</span> {body.suggestedBudgetSplit}</p>
          )}
        </div>
      )

    case "keyword_cluster":
      return (
        <div className="space-y-1 text-sm text-foreground">
          {Array.isArray(body.exampleKeywords) && (
            <p><span className="text-muted-foreground">Keywords:</span> {(body.exampleKeywords as string[]).join(", ")}</p>
          )}
          {typeof body.funnelStage === "string" && (
            <p><span className="text-muted-foreground">Funnel stage:</span> {body.funnelStage}</p>
          )}
          {typeof body.serpTarget === "string" && (
            <p><span className="text-muted-foreground">SERP target:</span> {body.serpTarget}</p>
          )}
        </div>
      )

    case "landing_page_idea": {
      const sections =
        Array.isArray(body.sections)
          ? body.sections as { name: string; purpose: string; copyHint: string }[]
          : []

      return (
        <div className="space-y-2 text-sm text-foreground">
          {typeof body.targetOffer === "string" && (
            <p><span className="text-muted-foreground">Target offer:</span> {body.targetOffer}</p>
          )}
          {typeof body.description === "string" && <p>{body.description}</p>}
          {sections.length > 0 && (
            <ul className="list-disc list-inside space-y-1">
              {sections.map((section, index) => (
                <li key={index}>
                  <span className="font-medium">{section.name}</span>
                  {section.purpose && (
                    <span className="text-muted-foreground"> — {section.purpose}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )
    }

    case "blog_idea":
    default:
      return (
        <div className="text-sm text-foreground">
          {typeof body.description === "string" && <p>{body.description}</p>}
        </div>
      )

  }

}

export default function ContentItemDialog({
  item,
  open,
  onOpenChange,
  onUpdated,
  onDeleted
}: {
  item: ContentItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (item: ContentItem) => void
  onDeleted: (id: string) => void
}) {

  if (!item) {
    return null
  }

  // Keying by item.id fully remounts this dialog whenever a different
  // item is opened, so its form state always starts fresh from that
  // item's fields — no effect needed to sync state on prop change.
  return (
    <ContentItemDialogInner
      key={item.id}
      item={item}
      open={open}
      onOpenChange={onOpenChange}
      onUpdated={onUpdated}
      onDeleted={onDeleted}
    />
  )

}

function ContentItemDialogInner({
  item,
  open,
  onOpenChange,
  onUpdated,
  onDeleted
}: {
  item: ContentItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (item: ContentItem) => void
  onDeleted: (id: string) => void
}) {

  const [title, setTitle] =
    useState(item.title)

  const [status, setStatus] =
    useState<ContentItemStatus>(item.status)

  const [notes, setNotes] =
    useState(item.notes || "")

  const [saving, setSaving] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  // Seeded once from the item prop, then updated directly from the
  // generate-creative response -- not re-read from `item` afterward, since
  // this dialog's parent never refreshes the `item` prop mid-session (only
  // its own `items` array, via onUpdated), so re-reading `item.body` here
  // would just show stale variations until the dialog is closed and reopened.
  const [variations, setVariations] =
    useState<CreativeVariation[]>(
      Array.isArray(item.body?.creativeVariations)
        ? (item.body.creativeVariations as CreativeVariation[])
        : []
    )

  const [generating, setGenerating] =
    useState(false)

  const [copiedIndex, setCopiedIndex] =
    useState<number | null>(null)

  async function handleGenerateCreative() {

    setGenerating(true)
    setError(null)

    try {

      const response =
        await fetch(`/api/content-items/${item.id}/generate-creative`, {
          method: "POST"
        })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || "Failed to generate creative.")
        return
      }

      const updatedVariations =
        Array.isArray(result.data.body?.creativeVariations)
          ? (result.data.body.creativeVariations as CreativeVariation[])
          : []

      setVariations(updatedVariations)
      onUpdated(result.data)

    } catch (err) {

      console.error(err)
      setError("Failed to generate creative.")

    } finally {

      setGenerating(false)

    }

  }

  async function handleCopyVariation(variation: CreativeVariation, index: number) {

    try {

      await navigator.clipboard.writeText(
        `${variation.headline}\n${variation.body}`
      )

      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 1500)

    } catch (err) {

      console.error(err)

    }

  }

  async function handleSave() {

    if (!item) return

    setSaving(true)
    setError(null)

    try {

      const response =
        await fetch(`/api/content-items/${item.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title,
            status,
            notes
          })
        })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || "Failed to save changes.")
        return
      }

      onUpdated(result.data)
      onOpenChange(false)

    } catch (err) {

      console.error(err)
      setError("Failed to save changes.")

    } finally {

      setSaving(false)

    }

  }

  async function handleDelete() {

    if (!item) return

    const confirmed =
      confirm("Delete this content item permanently?")

    if (!confirmed) return

    try {

      const response =
        await fetch(`/api/content-items/${item.id}`, {
          method: "DELETE"
        })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || "Failed to delete item.")
        return
      }

      onDeleted(item.id)
      onOpenChange(false)

    } catch (err) {

      console.error(err)
      setError("Failed to delete item.")

    }

  }

  return (

    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent className="sm:max-w-lg bg-background border border-border">

        <DialogHeader>
          <Badge variant="outline" className="w-fit">
            {contentItemTypeLabels[item.type]}
          </Badge>
          <DialogTitle className="text-foreground">
            AI-generated content
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-card p-4">
          {renderBody(item)}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">

          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-foreground">
              Creative Variations
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateCreative}
              disabled={generating}
            >
              {generating
                ? "Generating…"
                : variations.length > 0
                  ? "Generate More"
                  : "Generate Creative"}
            </Button>
          </div>

          {variations.length === 0 ? (

            <p className="text-sm text-muted-foreground mt-3">
              No creative generated yet.
            </p>

          ) : (

            <div className="space-y-3 mt-3">
              {variations.map((variation, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border bg-background p-3"
                >
                  <p className="text-sm font-medium text-foreground">
                    {variation.headline}
                  </p>
                  {variation.body && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {variation.body}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="mt-2"
                    onClick={() => handleCopyVariation(variation, index)}
                  >
                    {copiedIndex === index ? "Copied" : "Copy"}
                  </Button>
                </div>
              ))}
            </div>

          )}

        </div>

        <div className="space-y-3">

          <div>
            <label className="text-xs text-muted-foreground">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <div className="mt-1 flex gap-2">
              {statusOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={status === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatus(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Your notes, expanded draft, or edits go here"
              className="mt-1"
              rows={5}
            />
          </div>

        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <DialogFooter>
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>

      </DialogContent>

    </Dialog>

  )

}
