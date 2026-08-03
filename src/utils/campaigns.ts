export const CAMPAIGN_STATUSES = [
  "draft",
  "active",
  "paused",
  "completed"
] as const

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

export const campaignStatusLabels: Record<CampaignStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  completed: "Completed"
}

export type AdSet = {
  id: string
  campaign_id: string
  org_id: string
  audience_angle: string | null
  creative_angle: string | null
  suggested_budget_split: string | null
  status: CampaignStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export type Campaign = {
  id: string
  org_id: string
  audit_id: string | null
  site_url: string | null
  name: string
  objective: string | null
  target_audience: string | null
  key_message: string | null
  channels: string[]
  status: CampaignStatus
  budget: number | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  ad_sets?: AdSet[]
}
