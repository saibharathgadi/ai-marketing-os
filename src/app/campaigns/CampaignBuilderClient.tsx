"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import CampaignDialog from "@/components/CampaignDialog"
import AdSetDialog from "@/components/AdSetDialog"
import {
  CAMPAIGN_STATUSES,
  campaignStatusLabels,
  type AdSet,
  type Campaign,
  type CampaignStatus
} from "@/utils/campaigns"

function statusVariant(status: CampaignStatus) {
  if (status === "active") return "default" as const
  if (status === "completed") return "secondary" as const
  return "outline" as const
}

function formatRelativeDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  })
}

export default function CampaignBuilderClient() {

  const [campaigns, setCampaigns] =
    useState<Campaign[]>([])

  const [loading, setLoading] =
    useState(true)

  const [statusFilter, setStatusFilter] =
    useState<CampaignStatus | "all">("all")

  const [search, setSearch] =
    useState("")

  const [campaignDialogOpen, setCampaignDialogOpen] =
    useState(false)

  const [activeCampaign, setActiveCampaign] =
    useState<Campaign | null>(null)

  const [adSetDialogOpen, setAdSetDialogOpen] =
    useState(false)

  const [activeAdSet, setActiveAdSet] =
    useState<AdSet | null>(null)

  const [activeAdSetCampaignId, setActiveAdSetCampaignId] =
    useState<string | null>(null)

  async function loadCampaigns() {

    try {

      const response = await fetch("/api/campaigns")
      const result = await response.json()

      if (result.success) {
        setCampaigns(result.data)
      }

    } catch (error) {

      console.error(error)

    } finally {

      setLoading(false)

    }

  }

  useEffect(() => {

    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCampaigns()

  }, [])

  const filteredCampaigns = useMemo(() => {

    return campaigns.filter((campaign) => {

      if (statusFilter !== "all" && campaign.status !== statusFilter) {
        return false
      }

      if (
        search.trim() &&
        !campaign.name.toLowerCase().includes(search.trim().toLowerCase())
      ) {
        return false
      }

      return true

    })

  }, [campaigns, statusFilter, search])

  function openNewCampaign() {
    setActiveCampaign(null)
    setCampaignDialogOpen(true)
  }

  function openEditCampaign(campaign: Campaign) {
    setActiveCampaign(campaign)
    setCampaignDialogOpen(true)
  }

  function openNewAdSet(campaignId: string) {
    setActiveAdSet(null)
    setActiveAdSetCampaignId(campaignId)
    setAdSetDialogOpen(true)
  }

  function openEditAdSet(campaignId: string, adSet: AdSet) {
    setActiveAdSet(adSet)
    setActiveAdSetCampaignId(campaignId)
    setAdSetDialogOpen(true)
  }

  function handleCampaignSaved(saved: Campaign) {

    setCampaigns((prev) => {

      const exists = prev.some((campaign) => campaign.id === saved.id)

      if (exists) {
        return prev.map((campaign) =>
          campaign.id === saved.id ? saved : campaign
        )
      }

      return [saved, ...prev]

    })

  }

  function handleCampaignDeleted(id: string) {
    setCampaigns((prev) => prev.filter((campaign) => campaign.id !== id))
  }

  function handleAdSetSaved(saved: AdSet) {

    setCampaigns((prev) =>
      prev.map((campaign) => {

        if (campaign.id !== saved.campaign_id) {
          return campaign
        }

        const existingAdSets = campaign.ad_sets ?? []
        const exists = existingAdSets.some((adSet) => adSet.id === saved.id)

        return {
          ...campaign,
          ad_sets: exists
            ? existingAdSets.map((adSet) =>
                adSet.id === saved.id ? saved : adSet
              )
            : [...existingAdSets, saved]
        }

      })
    )

  }

  function handleAdSetDeleted(id: string) {

    setCampaigns((prev) =>
      prev.map((campaign) => ({
        ...campaign,
        ad_sets: (campaign.ad_sets ?? []).filter((adSet) => adSet.id !== id)
      }))
    )

  }

  return (

    <main className="min-h-screen bg-background text-foreground">

      <div className="max-w-7xl mx-auto px-6 py-16">

        <div className="flex items-center justify-between gap-4 flex-wrap">

          <div>
            <h1 className="text-4xl font-bold">Campaign Builder</h1>
            <p className="text-muted-foreground mt-2">
              Plan campaigns and their ad sets — saved from audits or created from scratch.
            </p>
          </div>

          <Button onClick={openNewCampaign}>+ New Campaign</Button>

        </div>

        <Card className="rounded-2xl border border-border bg-card p-6 mt-8">

          <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">

            <Input
              placeholder="Search by campaign name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:max-w-xs"
            />

            <div className="flex flex-wrap gap-2">

              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                All statuses
              </Button>

              {CAMPAIGN_STATUSES.map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {campaignStatusLabels[status]}
                </Button>
              ))}

            </div>

          </div>

        </Card>

        {loading ? (

          <p className="text-muted-foreground mt-10">Loading…</p>

        ) : filteredCampaigns.length === 0 ? (

          <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            {campaigns.length === 0
              ? "No campaigns yet — save ad campaign ideas from an audit's AI Marketing Copilot tabs, or create one from scratch."
              : "No campaigns match your filters."}
          </div>

        ) : (

          <div className="space-y-4 mt-8">

            {filteredCampaigns.map((campaign) => (

              <Card
                key={campaign.id}
                className="rounded-2xl border border-border bg-card p-6 cursor-pointer hover:border-muted-foreground/30 transition"
                onClick={() => openEditCampaign(campaign)}
              >

                <div className="flex items-start justify-between gap-4 flex-wrap">

                  <div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(campaign.status)}>
                        {campaignStatusLabels[campaign.status]}
                      </Badge>
                      {campaign.channels.map((channel) => (
                        <Badge key={channel} variant="secondary">
                          {channel}
                        </Badge>
                      ))}
                    </div>

                    <h3 className="text-lg font-semibold mt-3">
                      {campaign.name}
                    </h3>

                    {campaign.objective && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {campaign.objective}
                      </p>
                    )}

                  </div>

                  <div className="text-xs text-muted-foreground text-right">
                    {campaign.audit_id && campaign.site_url ? (
                      <Link
                        href={`/audit/${campaign.audit_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-foreground"
                      >
                        {campaign.site_url}
                      </Link>
                    ) : null}
                    <p className="mt-1">
                      {formatRelativeDate(campaign.created_at)}
                    </p>
                  </div>

                </div>

                {(campaign.budget !== null || campaign.start_date || campaign.end_date) && (

                  <p className="text-xs text-muted-foreground mt-3">
                    {campaign.budget !== null && `Budget: ${campaign.budget}`}
                    {campaign.budget !== null && (campaign.start_date || campaign.end_date) && " · "}
                    {campaign.start_date && `Starts ${campaign.start_date}`}
                    {campaign.start_date && campaign.end_date && " · "}
                    {campaign.end_date && `Ends ${campaign.end_date}`}
                  </p>

                )}

                <div className="mt-4 pt-4 border-t border-border">

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Ad Sets
                    </p>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        openNewAdSet(campaign.id)
                      }}
                    >
                      + Add Ad Set
                    </Button>
                  </div>

                  {(campaign.ad_sets ?? []).length === 0 ? (

                    <p className="text-sm text-muted-foreground mt-2">
                      No ad sets yet.
                    </p>

                  ) : (

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">

                      {(campaign.ad_sets ?? []).map((adSet) => (

                        <div
                          key={adSet.id}
                          className="rounded-xl border border-border bg-background p-3 cursor-pointer hover:border-muted-foreground/30 transition"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditAdSet(campaign.id, adSet)
                          }}
                        >

                          <div className="flex items-center justify-between gap-2">
                            <Badge variant={statusVariant(adSet.status)}>
                              {campaignStatusLabels[adSet.status]}
                            </Badge>
                          </div>

                          {adSet.audience_angle && (
                            <p className="text-sm mt-2 line-clamp-2">
                              {adSet.audience_angle}
                            </p>
                          )}

                          {adSet.suggested_budget_split && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {adSet.suggested_budget_split}
                            </p>
                          )}

                        </div>

                      ))}

                    </div>

                  )}

                </div>

              </Card>

            ))}

          </div>

        )}

      </div>

      <CampaignDialog
        campaign={activeCampaign}
        open={campaignDialogOpen}
        onOpenChange={setCampaignDialogOpen}
        onSaved={handleCampaignSaved}
        onDeleted={handleCampaignDeleted}
      />

      {activeAdSetCampaignId && (
        <AdSetDialog
          campaignId={activeAdSetCampaignId}
          adSet={activeAdSet}
          open={adSetDialogOpen}
          onOpenChange={setAdSetDialogOpen}
          onSaved={handleAdSetSaved}
          onDeleted={handleAdSetDeleted}
        />
      )}

    </main>

  )

}
