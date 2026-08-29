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
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem
} from "@/components/ui/select"
import {
  CONTENT_ITEM_TYPES,
  contentItemTypeLabels,
  type ContentItem,
  type ContentItemType
} from "@/utils/contentItems"

/**
 * Standalone creation entry point — every other way a content item comes
 * to exist starts from an audit's AI Marketing Copilot tabs. This is the
 * one that doesn't: a blank idea a user wants to track without having run
 * an audit for it first. Posts to the same /api/content-items endpoint
 * the audit-derived save buttons already use, just with no auditId.
 */
export default function NewContentItemDialog({
  open,
  onOpenChange,
  onCreated
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (item: ContentItem) => void
}) {

  const [type, setType] =
    useState<ContentItemType>("blog_idea")

  const [title, setTitle] =
    useState("")

  const [description, setDescription] =
    useState("")

  const [saving, setSaving] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  function reset() {
    setType("blog_idea")
    setTitle("")
    setDescription("")
    setError(null)
  }

  async function handleCreate() {

    if (!title.trim()) {
      setError("Title is required.")
      return
    }

    setSaving(true)
    setError(null)

    try {

      const response =
        await fetch("/api/content-items", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            type,
            title: title.trim(),
            body: description.trim()
              ? { description: description.trim() }
              : {}
          })
        })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || "Failed to create content item.")
        return
      }

      onCreated(result.data)
      onOpenChange(false)
      reset()

    } catch (err) {

      console.error(err)
      setError("Failed to create content item.")

    } finally {

      setSaving(false)

    }

  }

  return (

    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >

      <DialogContent className="sm:max-w-lg bg-background border border-border">

        <DialogHeader>
          <DialogTitle className="text-foreground">
            New content idea
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">

          <div>
            <label className="text-xs text-muted-foreground">Type</label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as ContentItemType)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_ITEM_TYPES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {contentItemTypeLabels[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Comparison post vs. our top competitor"
              className="mt-1"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Description (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any details, angle, or notes to start from"
              className="mt-1"
              rows={4}
            />
          </div>

        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <DialogFooter>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>

      </DialogContent>

    </Dialog>

  )

}
