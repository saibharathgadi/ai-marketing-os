import ContentItemCard from "@/components/ContentItemCard"
import {
  CONTENT_ITEM_STATUSES,
  type ContentItem,
  type ContentItemStatus
} from "@/utils/contentItems"

const columnLabels: Record<ContentItemStatus, string> = {
  idea: "Idea",
  drafted: "Drafted",
  published: "Published"
}

export default function ContentBoard({
  items,
  onMoveStatus,
  onOpenItem
}: {
  items: ContentItem[]
  onMoveStatus: (id: string, newStatus: ContentItemStatus) => void
  onOpenItem: (item: ContentItem) => void
}) {

  return (

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">

      {CONTENT_ITEM_STATUSES.map((status) => {

        const columnItems = items.filter((item) => item.status === status)

        return (

          <div
            key={status}
            className="rounded-xl border border-border bg-card/50 p-4"
          >

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                {columnLabels[status]}
              </h2>
              <span className="text-xs text-muted-foreground">
                {columnItems.length}
              </span>
            </div>

            {columnItems.length === 0 ? (

              <p className="text-sm text-muted-foreground">
                No items
              </p>

            ) : (

              <div className="space-y-3">
                {columnItems.map((item) => (
                  <ContentItemCard
                    key={item.id}
                    item={item}
                    variant="board"
                    onClick={() => onOpenItem(item)}
                    onMoveStatus={(newStatus) => onMoveStatus(item.id, newStatus)}
                  />
                ))}
              </div>

            )}

          </div>

        )

      })}

    </div>

  )

}
