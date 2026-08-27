import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  CONTENT_ITEM_STATUSES,
  contentItemTypeLabels,
  type ContentItem,
  type ContentItemStatus
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

export default function ContentItemCard({
  item,
  variant,
  onClick,
  selected,
  onToggleSelect,
  onMoveStatus
}: {
  item: ContentItem
  variant: "list" | "board"
  onClick: () => void
  selected?: boolean
  onToggleSelect?: () => void
  onMoveStatus?: (newStatus: ContentItemStatus) => void
}) {

  const statusIndex = CONTENT_ITEM_STATUSES.indexOf(item.status)
  const previousStatus = CONTENT_ITEM_STATUSES[statusIndex - 1]
  const nextStatus = CONTENT_ITEM_STATUSES[statusIndex + 1]

  return (

    <Card
      className={`rounded-xl border p-5 cursor-pointer transition ${
        variant === "list" && selected
          ? "border-violet-500/50 bg-card"
          : "border-border bg-card hover:border-muted-foreground/30"
      }`}
      onClick={onClick}
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

        {variant === "list" && (
          <input
            type="checkbox"
            checked={selected}
            onClick={(e) => e.stopPropagation()}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded border-border bg-background accent-violet-500 mt-0.5"
          />
        )}

      </div>

      <h3 className="text-base font-semibold mt-3 line-clamp-2">
        {item.title}
      </h3>

      <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">

        {item.audit_id ? (
          <Link
            href={`/audit/${item.audit_id}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:text-foreground truncate"
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

      {variant === "board" && onMoveStatus && (

        <div className="flex items-center justify-between mt-4 gap-2">

          {previousStatus ? (
            <Button
              variant="outline"
              size="xs"
              onClick={(e) => {
                e.stopPropagation()
                onMoveStatus(previousStatus)
              }}
            >
              ← Move
            </Button>
          ) : <span />}

          {nextStatus && (
            <Button
              variant="outline"
              size="xs"
              onClick={(e) => {
                e.stopPropagation()
                onMoveStatus(nextStatus)
              }}
            >
              Move →
            </Button>
          )}

        </div>

      )}

    </Card>

  )

}
