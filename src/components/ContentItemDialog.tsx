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
  type ContentItemStatus
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
            <p className="text-sm text-zinc-400">{body.description}</p>
          )}
          <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-300">
            {posts.map((post, index) => (
              <li key={index}>
                <span className="font-medium">{post.title}</span>
                {post.angle && (
                  <span className="text-zinc-500"> — {post.angle}</span>
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
          <ul className="space-y-2 text-sm text-zinc-300">
            {posts.map((post, index) => (
              <li key={index}>
                <p className="font-medium">{post.hook}</p>
                {post.caption && (
                  <p className="text-zinc-500 mt-1">{post.caption}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )
    }

    case "social_idea":
      return (
        <div className="space-y-2 text-sm text-zinc-300">
          {typeof body.platform === "string" && (
            <Badge variant="outline">{body.platform}</Badge>
          )}
          {typeof body.idea === "string" && <p>{body.idea}</p>}
        </div>
      )

    case "ad_campaign":
      return (
        <div className="space-y-1 text-sm text-zinc-300">
          {typeof body.objective === "string" && (
            <p><span className="text-zinc-500">Objective:</span> {body.objective}</p>
          )}
          {typeof body.targetAudience === "string" && (
            <p><span className="text-zinc-500">Audience:</span> {body.targetAudience}</p>
          )}
          {typeof body.keyMessage === "string" && (
            <p><span className="text-zinc-500">Key message:</span> {body.keyMessage}</p>
          )}
          {Array.isArray(body.channels) && (
            <p><span className="text-zinc-500">Channels:</span> {(body.channels as string[]).join(", ")}</p>
          )}
        </div>
      )

    case "ad_set":
      return (
        <div className="space-y-1 text-sm text-zinc-300">
          {typeof body.audienceAngle === "string" && (
            <p><span className="text-zinc-500">Audience angle:</span> {body.audienceAngle}</p>
          )}
          {typeof body.creativeAngle === "string" && (
            <p><span className="text-zinc-500">Creative angle:</span> {body.creativeAngle}</p>
          )}
          {typeof body.suggestedBudgetSplit === "string" && (
            <p><span className="text-zinc-500">Budget split:</span> {body.suggestedBudgetSplit}</p>
          )}
        </div>
      )

    case "keyword_cluster":
      return (
        <div className="space-y-1 text-sm text-zinc-300">
          {Array.isArray(body.exampleKeywords) && (
            <p><span className="text-zinc-500">Keywords:</span> {(body.exampleKeywords as string[]).join(", ")}</p>
          )}
          {typeof body.funnelStage === "string" && (
            <p><span className="text-zinc-500">Funnel stage:</span> {body.funnelStage}</p>
          )}
          {typeof body.serpTarget === "string" && (
            <p><span className="text-zinc-500">SERP target:</span> {body.serpTarget}</p>
          )}
        </div>
      )

    case "landing_page_idea": {
      const sections =
        Array.isArray(body.sections)
          ? body.sections as { name: string; purpose: string; copyHint: string }[]
          : []

      return (
        <div className="space-y-2 text-sm text-zinc-300">
          {typeof body.targetOffer === "string" && (
            <p><span className="text-zinc-500">Target offer:</span> {body.targetOffer}</p>
          )}
          {typeof body.description === "string" && <p>{body.description}</p>}
          {sections.length > 0 && (
            <ul className="list-disc list-inside space-y-1">
              {sections.map((section, index) => (
                <li key={index}>
                  <span className="font-medium">{section.name}</span>
                  {section.purpose && (
                    <span className="text-zinc-500"> — {section.purpose}</span>
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
        <div className="text-sm text-zinc-300">
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

      <DialogContent className="sm:max-w-lg bg-zinc-950 border border-zinc-800">

        <DialogHeader>
          <Badge variant="outline" className="w-fit">
            {contentItemTypeLabels[item.type]}
          </Badge>
          <DialogTitle className="text-white">
            AI-generated content
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          {renderBody(item)}
        </div>

        <div className="space-y-3">

          <div>
            <label className="text-xs text-zinc-500">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500">Status</label>
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
            <label className="text-xs text-zinc-500">Notes</label>
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
