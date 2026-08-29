import { Card } from "@/components/ui/card"

export default function StatCard({
  label,
  value,
  subtext
}: {
  label: string
  value: number | string
  subtext?: string
}) {
  return (
    <Card className="rounded-2xl border border-border bg-card p-6">
      <p className="text-muted-foreground text-sm">{label}</p>
      <h2 className="text-4xl font-bold mt-3 bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
        {value}
      </h2>
      {subtext && (
        <p className="text-xs text-muted-foreground mt-2">{subtext}</p>
      )}
    </Card>
  )
}
