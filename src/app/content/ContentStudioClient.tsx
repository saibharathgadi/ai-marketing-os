"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import ContentItemDialog from "@/components/ContentItemDialog"
import {
  CONTENT_ITEM_TYPES,
  CONTENT_ITEM_STATUSES,
  contentItemTypeLabels,
  type ContentItem,
  type ContentItemStatus,
  type ContentItemType
} from "@/utils/contentItems"

function statusVariant(status: ContentItemStatus) {
  if (status === "published") return "default" as const
  if (status === "drafted") return "secondary" as const
  return "outline" as const
}

function formatRelativeDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  })
}

export default function ContentStudioClient() {

  const [items, setItems] =
    useState<ContentItem[]>([])

  const [loading, setLoading] =
    useState(true)

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

  const filteredItems = useMemo(() => {

    return items.filter((item) => {

      if (typeFilter !== "all" && item.type !== typeFilter) {
        return false
      }

      if (statusFilter !== "all" && item.status !== statusFilter) {
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

  }, [items, typeFilter, statusFilter, search])

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

  return (

    <main className="min-h-screen bg-black text-white">

      <div className="max-w-7xl mx-auto px-6 py-16">

        <div>
          <h1 className="text-4xl font-bold">Content Studio</h1>
          <p className="text-zinc-400 mt-2">
            Saved content ideas from your audits — edit, track, and manage them here.
          </p>
        </div>

        <Card className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 mt-8">

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

        </Card>

        {loading ? (

          <p className="text-zinc-500 mt-10">Loading…</p>

        ) : filteredItems.length === 0 ? (

          <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-400">
            {items.length === 0
              ? "No saved content yet — save ideas from an audit's AI Marketing Copilot tabs to see them here."
              : "No content items match your filters."}
          </div>

        ) : (

          <>

            <div className="flex items-center gap-3 mt-8">

              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input
                  type="checkbox"
                  checked={
                    selectedIds.size === filteredItems.length &&
                    filteredItems.length > 0
                  }
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-zinc-700 bg-black accent-violet-500"
                />
                Select all
              </label>

              {selectedIds.size > 0 && (

                <>
                  <span className="text-sm text-zinc-500">
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

                <Card
                  key={item.id}
                  className={`rounded-xl border p-5 cursor-pointer transition ${
                    selectedIds.has(item.id)
                      ? "border-violet-500/50 bg-zinc-900"
                      : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                  }`}
                  onClick={() => {
                    setActiveItem(item)
                    setDialogOpen(true)
                  }}
                >

                  <div className="flex items-start justify-between gap-2">

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {contentItemTypeLabels[item.type]}
                      </Badge>
                      <Badge variant={statusVariant(item.status)}>
                        {item.status}
                      </Badge>
                    </div>

                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelected(item.id)}
                      className="h-4 w-4 rounded border-zinc-700 bg-black accent-violet-500 mt-0.5"
                    />

                  </div>

                  <h3 className="text-base font-semibold mt-3 line-clamp-2">
                    {item.title}
                  </h3>

                  <div className="flex items-center justify-between mt-4 text-xs text-zinc-500">

                    {item.audit_id ? (
                      <Link
                        href={`/audit/${item.audit_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-zinc-300 truncate"
                      >
                        {item.site_url || "Source audit"}
                      </Link>
                    ) : (
                      <span className="truncate">
                        {item.site_url || "—"}
                      </span>
                    )}

                    <span>{formatRelativeDate(item.created_at)}</span>

                  </div>

                </Card>

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
