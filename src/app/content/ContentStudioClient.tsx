"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import ContentItemDialog from "@/components/ContentItemDialog"
import ContentItemCard from "@/components/ContentItemCard"
import ContentBoard from "@/components/ContentBoard"
import {
  CONTENT_ITEM_TYPES,
  CONTENT_ITEM_STATUSES,
  contentItemTypeLabels,
  type ContentItem,
  type ContentItemStatus,
  type ContentItemType
} from "@/utils/contentItems"

export default function ContentStudioClient() {

  const [items, setItems] =
    useState<ContentItem[]>([])

  const [loading, setLoading] =
    useState(true)

  const [viewMode, setViewMode] =
    useState<"list" | "board">("list")

  const [typeFilter, setTypeFilter] =
    useState<ContentItemType | "all">("all")

  const [statusFilter, setStatusFilter] =
    useState<ContentItemStatus | "all">("all")

  const [search, setSearch] =
    useState("")

  const [selectedIds, setSelectedIds] =
    useState<Set<string>>(new Set())

  const [bulkDeleting, setBulkDeleting] =
    useState(false)

  const [activeItem, setActiveItem] =
    useState<ContentItem | null>(null)

  const [dialogOpen, setDialogOpen] =
    useState(false)

  async function loadItems() {

    try {

      const response = await fetch("/api/content-items")
      const result = await response.json()

      if (result.success) {
        setItems(result.data)
      }

    } catch (error) {

      console.error(error)

    } finally {

      setLoading(false)

    }

  }

  useEffect(() => {

    // setState only happens after loadItems' internal `await` resolves,
    // never synchronously within this effect — fetch-on-mount, not a
    // cascading-render risk.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadItems()

  }, [])

  // Board view visualizes status as columns, so a separate status filter
  // on top of that would just hide whole columns for no clear reason —
  // ignore it there without losing the value for when the user switches
  // back to list view.
  const effectiveStatusFilter =
    viewMode === "board" ? "all" : statusFilter

  const filteredItems = useMemo(() => {

    return items.filter((item) => {

      if (typeFilter !== "all" && item.type !== typeFilter) {
        return false
      }

      if (effectiveStatusFilter !== "all" && item.status !== effectiveStatusFilter) {
        return false
      }

      if (
        search.trim() &&
        !item.title.toLowerCase().includes(search.trim().toLowerCase())
      ) {
        return false
      }

      return true

    })

  }, [items, typeFilter, effectiveStatusFilter, search])

  function toggleSelected(id: string) {

    setSelectedIds((prev) => {

      const next = new Set(prev)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next

    })

  }

  function toggleSelectAll() {

    setSelectedIds((prev) => {

      if (prev.size === filteredItems.length && filteredItems.length > 0) {
        return new Set()
      }

      return new Set(filteredItems.map((item) => item.id))

    })

  }

  async function deleteItemById(id: string) {

    try {

      const response = await fetch(`/api/content-items/${id}`, {
        method: "DELETE"
      })

      const result = await response.json()

      return result.success as boolean

    } catch (error) {

      console.error(error)
      return false

    }

  }

  async function handleBulkDelete() {

    if (selectedIds.size === 0) return

    const confirmed = confirm(
      `Delete ${selectedIds.size} selected item${selectedIds.size === 1 ? "" : "s"} permanently?`
    )

    if (!confirmed) return

    setBulkDeleting(true)

    try {

      const idsToDelete = [...selectedIds]

      const results = await Promise.all(
        idsToDelete.map((id) => deleteItemById(id))
      )

      const deletedIds = idsToDelete.filter((_, index) => results[index])

      setItems((prev) => prev.filter((item) => !deletedIds.includes(item.id)))
      setSelectedIds(new Set())

      if (deletedIds.length < idsToDelete.length) {
        alert(`Deleted ${deletedIds.length} of ${idsToDelete.length} items. Some failed — please retry.`)
      }

    } catch (error) {

      console.error(error)
      alert("Something went wrong deleting the selected items.")

    } finally {

      setBulkDeleting(false)

    }

  }

  function handleItemUpdated(updated: ContentItem) {

    setItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    )

  }

  function handleItemDeleted(id: string) {

    setItems((prev) => prev.filter((item) => item.id !== id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  }

  async function handleMoveStatus(id: string, newStatus: ContentItemStatus) {

    try {

      const response =
        await fetch(`/api/content-items/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ status: newStatus })
        })

      const result = await response.json()

      if (!result.success) {
        alert(result.error || "Failed to move item.")
        return
      }

      handleItemUpdated(result.data)

    } catch (error) {

      console.error(error)
      alert("Failed to move item.")

    }

  }

  function openItem(item: ContentItem) {
    setActiveItem(item)
    setDialogOpen(true)
  }

  return (

    <main className="min-h-screen bg-background text-foreground">

      <div className="max-w-7xl mx-auto px-6 py-16">

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">

          <div>
            <h1 className="text-4xl font-bold">Content Studio</h1>
            <p className="text-muted-foreground mt-2">
              Saved content ideas from your audits — edit, track, and manage them here.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              List
            </Button>
            <Button
              variant={viewMode === "board" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("board")}
            >
              Board
            </Button>
          </div>

        </div>

        <Card className="rounded-2xl border border-border bg-card p-6 mt-8">

          <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">

            <Input
              placeholder="Search by title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:max-w-xs"
            />

            <div className="flex flex-wrap gap-2">

              <Button
                variant={typeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter("all")}
              >
                All types
              </Button>

              {CONTENT_ITEM_TYPES.map((type) => (
                <Button
                  key={type}
                  variant={typeFilter === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTypeFilter(type)}
                >
                  {contentItemTypeLabels[type]}
                </Button>
              ))}

            </div>

          </div>

          {viewMode === "list" && (

            <div className="flex flex-wrap gap-2 mt-4">

              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                All statuses
              </Button>

              {CONTENT_ITEM_STATUSES.map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status[0].toUpperCase() + status.slice(1)}
                </Button>
              ))}

            </div>

          )}

        </Card>

        {loading ? (

          <p className="text-muted-foreground mt-10">Loading…</p>

        ) : filteredItems.length === 0 ? (

          <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            {items.length === 0
              ? "No saved content yet — save ideas from an audit's AI Marketing Copilot tabs to see them here."
              : "No content items match your filters."}
          </div>

        ) : viewMode === "board" ? (

          <ContentBoard
            items={filteredItems}
            onMoveStatus={handleMoveStatus}
            onOpenItem={openItem}
          />

        ) : (

          <>

            <div className="flex items-center gap-3 mt-8">

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={
                    selectedIds.size === filteredItems.length &&
                    filteredItems.length > 0
                  }
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-border bg-background accent-violet-500"
                />
                Select all
              </label>

              {selectedIds.size > 0 && (

                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size} selected
                  </span>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                  >
                    {bulkDeleting
                      ? "Deleting…"
                      : `Delete ${selectedIds.size} selected`}
                  </Button>
                </>

              )}

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">

              {filteredItems.map((item) => (
                <ContentItemCard
                  key={item.id}
                  item={item}
                  variant="list"
                  selected={selectedIds.has(item.id)}
                  onToggleSelect={() => toggleSelected(item.id)}
                  onClick={() => openItem(item)}
                />
              ))}

            </div>

          </>

        )}

      </div>

      <ContentItemDialog
        item={activeItem}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdated={handleItemUpdated}
        onDeleted={handleItemDeleted}
      />

    </main>

  )

}
