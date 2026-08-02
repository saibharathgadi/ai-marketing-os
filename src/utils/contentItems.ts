export const CONTENT_ITEM_TYPES = [
  "blog_idea",
  "blog_series",
  "social_idea",
  "social_series",
  "ad_campaign",
  "ad_set",
  "landing_page_idea",
  "keyword_cluster"
] as const

export type ContentItemType = (typeof CONTENT_ITEM_TYPES)[number]

export const CONTENT_ITEM_STATUSES = [
  "idea",
  "drafted",
  "published"
] as const

export type ContentItemStatus = (typeof CONTENT_ITEM_STATUSES)[number]

export type ContentItem = {
  id: string
  org_id: string
  audit_id: string | null
  site_url: string | null
  type: ContentItemType
  status: ContentItemStatus
  title: string
  body: Record<string, unknown>
  notes: string | null
  created_at: string
  updated_at: string
}

export const contentItemTypeLabels: Record<ContentItemType, string> = {
  blog_idea: "Blog Idea",
  blog_series: "Blog Series",
  social_idea: "Social Idea",
  social_series: "Social Series",
  ad_campaign: "Ad Campaign",
  ad_set: "Ad Set",
  landing_page_idea: "Landing Page",
  keyword_cluster: "Keyword Cluster"
}
