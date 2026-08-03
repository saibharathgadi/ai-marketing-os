"use client"

import { useState } from "react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import SaveToContentStudioButton from "@/components/SaveToContentStudioButton"
import SaveCampaignButton from "@/components/SaveCampaignButton"
import SaveAdSetButton from "@/components/SaveAdSetButton"

export type AIInsights = {
  executiveSummary: string
  regressionExplanation: string
  priorityActions: {
    title: string
    reason: string
    severity: "high" | "medium" | "low"
  }[]
  rootCauseSummary: {
    issue: string
    type: string
    severity: string
  }[]
  keywordClusters: {
    cluster: string
    exampleKeywords: string[]
    funnelStage: string
    serpTarget: string
  }[]
  contentIdeas: {
    title: string
    description: string
    type: "blog" | "social" | "landing-page"
  }[]
  socialIdeas: {
    platform: string
    idea: string
  }[]
  blogSeries: {
    seriesTitle: string
    description: string
    posts: { title: string; angle: string }[]
  }[]
  socialSeries: {
    platform: string
    seriesTitle: string
    posts: { hook: string; caption: string }[]
  }[]
  adCampaigns: {
    name: string
    objective: string
    targetAudience: string
    keyMessage: string
    channels: string[]
  }[]
  adSets: {
    campaignName: string
    audienceAngle: string
    creativeAngle: string
    suggestedBudgetSplit: string
  }[]
  landingPageIdeas: {
    title: string
    targetOffer: string
    sections: { name: string; purpose: string; copyHint: string }[]
  }[]
  roadmap90Day: {
    zeroToTwoWeeks: string[]
    thirtyDays: string[]
    sixtyToNinetyDays: string[]
  }
  kpiFramework: {
    area: string
    metric: string
    baseline: string
    target: string
  }[]
  weeklyFocus: string
  marketingOpportunities: string[]
  detectedThemes: string[]
  source: "ai" | "fallback"
}

function severityVariant(severity: string) {
  const normalized = severity.toLowerCase()
  if (normalized === "high" || normalized === "critical")
    return "destructive" as const
  if (normalized === "medium") return "secondary" as const
  return "outline" as const
}

function SectionCard({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      {children}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="text-muted-foreground text-sm">
      No {label} generated for this audit yet.
    </p>
  )
}

export default function AuditCopilotTabs({
  aiInsights,
  auditId,
  siteUrl
}: {
  aiInsights: AIInsights
  auditId: string
  siteUrl: string
}) {
  const contentIdeas = aiInsights.contentIdeas || []
  const blogIdeas = contentIdeas.filter((idea) => idea.type === "blog")
  const landingIdeasFromContent = contentIdeas.filter(
    (idea) => idea.type === "landing-page"
  )

  // Campaign name -> saved Campaign Builder id. Ad sets require a real
  // campaign_id foreign key, so an ad set's Save button only unlocks once
  // its matching campaign has been saved in this session — see
  // SaveAdSetButton, which renders a hint instead of a button when absent.
  const [savedCampaignIds, setSavedCampaignIds] =
    useState<Map<string, string>>(new Map())

  function handleCampaignSaved(name: string, id: string) {
    setSavedCampaignIds((prev) => {
      const next = new Map(prev)
      next.set(name, id)
      return next
    })
  }

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-3xl font-bold">AI Marketing Copilot</h2>
        <Badge variant={aiInsights.source === "ai" ? "default" : "outline"}>
          {aiInsights.source === "ai"
            ? "AI generated"
            : "Rule-based (no AI key configured)"}
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList variant="line" className="border-b border-border pb-0">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="content">Content & Blog</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="ads">Ads & Campaigns</TabsTrigger>
          <TabsTrigger value="landing">Landing Pages</TabsTrigger>
          <TabsTrigger value="serp">SERP & Keywords</TabsTrigger>
          <TabsTrigger value="roadmap">Roadmap & KPIs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 space-y-4">
          <SectionCard title="Executive Summary">
            <p className="text-sm text-foreground">
              {aiInsights.executiveSummary}
            </p>
          </SectionCard>

          <SectionCard title="Weekly Focus">
            <p className="text-sm text-foreground">{aiInsights.weeklyFocus}</p>
          </SectionCard>

          <SectionCard title="Priority Actions">
            {aiInsights.priorityActions?.length ? (
              <ul className="space-y-3">
                {aiInsights.priorityActions.map((action, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Badge variant={severityVariant(action.severity)}>
                      {action.severity}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {action.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {action.reason}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState label="priority actions" />
            )}
          </SectionCard>

          <SectionCard title="Root Cause Summary">
            {aiInsights.rootCauseSummary?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="pb-2 pr-4 font-medium">Issue</th>
                      <th className="pb-2 pr-4 font-medium">Type</th>
                      <th className="pb-2 font-medium">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiInsights.rootCauseSummary.map((row, index) => (
                      <tr
                        key={index}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-2 pr-4 text-foreground">
                          {row.issue}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {row.type}
                        </td>
                        <td className="py-2">
                          <Badge variant={severityVariant(row.severity)}>
                            {row.severity}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState label="root cause findings" />
            )}
          </SectionCard>

          <SectionCard title="Marketing Opportunities & Themes">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Opportunities</p>
                <ul className="space-y-1.5 text-sm text-foreground list-disc list-inside">
                  {aiInsights.marketingOpportunities?.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Detected Themes</p>
                <div className="flex flex-wrap gap-2">
                  {aiInsights.detectedThemes?.length ? (
                    aiInsights.detectedThemes.map((theme, index) => (
                      <Badge key={index} variant="outline">
                        {theme}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No themes detected.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="content" className="mt-5 space-y-4">
          <SectionCard title="Blog & Content Ideas">
            {blogIdeas.length || landingIdeasFromContent.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {contentIdeas.map((idea, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <Badge variant="secondary">{idea.type}</Badge>
                    <p className="text-sm font-medium mt-2">{idea.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {idea.description}
                    </p>
                    <div className="mt-3">
                      <SaveToContentStudioButton
                        auditId={auditId}
                        siteUrl={siteUrl}
                        type={
                          idea.type === "blog"
                            ? "blog_idea"
                            : idea.type === "landing-page"
                              ? "landing_page_idea"
                              : "social_idea"
                        }
                        title={idea.title}
                        body={{ description: idea.description }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="content ideas" />
            )}
          </SectionCard>

          <SectionCard title="Blog Series Plans">
            {aiInsights.blogSeries?.length ? (
              <div className="space-y-4">
                {aiInsights.blogSeries.map((series, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <p className="text-sm font-semibold">
                      {series.seriesTitle}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {series.description}
                    </p>
                    <ol className="mt-3 space-y-1.5 text-sm text-foreground list-decimal list-inside">
                      {series.posts?.map((post, postIndex) => (
                        <li key={postIndex}>
                          {post.title}{" "}
                          <span className="text-muted-foreground">
                            — {post.angle}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-3">
                      <SaveToContentStudioButton
                        auditId={auditId}
                        siteUrl={siteUrl}
                        type="blog_series"
                        title={series.seriesTitle}
                        body={{
                          description: series.description,
                          posts: series.posts
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="blog series" />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="social" className="mt-5 space-y-4">
          <SectionCard title="Social Post Ideas">
            {aiInsights.socialIdeas?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aiInsights.socialIdeas.map((idea, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <Badge variant="secondary">{idea.platform}</Badge>
                    <p className="text-sm mt-2">{idea.idea}</p>
                    <div className="mt-3">
                      <SaveToContentStudioButton
                        auditId={auditId}
                        siteUrl={siteUrl}
                        type="social_idea"
                        title={idea.idea.slice(0, 60)}
                        body={{ platform: idea.platform, idea: idea.idea }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="social ideas" />
            )}
          </SectionCard>

          <SectionCard title="Social Post Series">
            {aiInsights.socialSeries?.length ? (
              <div className="space-y-4">
                {aiInsights.socialSeries.map((series, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{series.platform}</Badge>
                      <p className="text-sm font-semibold">
                        {series.seriesTitle}
                      </p>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {series.posts?.map((post, postIndex) => (
                        <li key={postIndex} className="text-sm">
                          <span className="font-medium text-foreground">
                            {post.hook}
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {post.caption}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3">
                      <SaveToContentStudioButton
                        auditId={auditId}
                        siteUrl={siteUrl}
                        type="social_series"
                        title={series.seriesTitle}
                        body={{
                          platform: series.platform,
                          posts: series.posts
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="social series" />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="ads" className="mt-5 space-y-4">
          <SectionCard title="Ad Campaign Ideas">
            {aiInsights.adCampaigns?.length ? (
              <div className="space-y-3">
                {aiInsights.adCampaigns.map((campaign, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <p className="text-sm font-semibold">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {campaign.objective}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm text-foreground">
                      <p>
                        <span className="text-muted-foreground">Audience: </span>
                        {campaign.targetAudience}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Key message: </span>
                        {campaign.keyMessage}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {campaign.channels?.map((channel, channelIndex) => (
                        <Badge key={channelIndex} variant="outline">
                          {channel}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <SaveToContentStudioButton
                        auditId={auditId}
                        siteUrl={siteUrl}
                        type="ad_campaign"
                        title={campaign.name}
                        body={{
                          objective: campaign.objective,
                          targetAudience: campaign.targetAudience,
                          keyMessage: campaign.keyMessage,
                          channels: campaign.channels
                        }}
                      />
                      <SaveCampaignButton
                        auditId={auditId}
                        siteUrl={siteUrl}
                        name={campaign.name}
                        objective={campaign.objective}
                        targetAudience={campaign.targetAudience}
                        keyMessage={campaign.keyMessage}
                        channels={campaign.channels || []}
                        onSaved={(id) =>
                          handleCampaignSaved(campaign.name, id)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="ad campaigns" />
            )}
          </SectionCard>

          <SectionCard title="Ad Set Ideas">
            {aiInsights.adSets?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aiInsights.adSets.map((adSet, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-border bg-card p-4 text-sm"
                  >
                    <p className="font-medium text-foreground">
                      {adSet.campaignName}
                    </p>
                    <p className="text-muted-foreground mt-2">
                      <span className="text-muted-foreground">Audience angle: </span>
                      {adSet.audienceAngle}
                    </p>
                    <p className="text-muted-foreground mt-1">
                      <span className="text-muted-foreground">Creative angle: </span>
                      {adSet.creativeAngle}
                    </p>
                    <p className="text-muted-foreground mt-1">
                      <span className="text-muted-foreground">Budget split: </span>
                      {adSet.suggestedBudgetSplit}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <SaveToContentStudioButton
                        auditId={auditId}
                        siteUrl={siteUrl}
                        type="ad_set"
                        title={adSet.campaignName}
                        body={{
                          audienceAngle: adSet.audienceAngle,
                          creativeAngle: adSet.creativeAngle,
                          suggestedBudgetSplit: adSet.suggestedBudgetSplit
                        }}
                      />
                      <SaveAdSetButton
                        campaignId={
                          savedCampaignIds.get(adSet.campaignName) ?? null
                        }
                        campaignName={adSet.campaignName}
                        audienceAngle={adSet.audienceAngle}
                        creativeAngle={adSet.creativeAngle}
                        suggestedBudgetSplit={adSet.suggestedBudgetSplit}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="ad sets" />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="landing" className="mt-5">
          <SectionCard title="Landing Page Suggestions">
            {aiInsights.landingPageIdeas?.length ? (
              <div className="space-y-4">
                {aiInsights.landingPageIdeas.map((page, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <p className="text-sm font-semibold">{page.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {page.targetOffer}
                    </p>
                    <div className="mt-3 space-y-2">
                      {page.sections?.map((section, sectionIndex) => (
                        <div
                          key={sectionIndex}
                          className="rounded-md bg-background border border-border p-3"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {section.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {section.purpose}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            &ldquo;{section.copyHint}&rdquo;
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
                      <SaveToContentStudioButton
                        auditId={auditId}
                        siteUrl={siteUrl}
                        type="landing_page_idea"
                        title={page.title}
                        body={{
                          targetOffer: page.targetOffer,
                          sections: page.sections
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="landing page suggestions" />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="serp" className="mt-5">
          <SectionCard title="Keyword Clusters & SERP Strategy">
            {aiInsights.keywordClusters?.length ? (
              <div className="space-y-3">
                {aiInsights.keywordClusters.map((cluster, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-semibold">
                        {cluster.cluster}
                      </p>
                      <Badge variant="outline">
                        {cluster.funnelStage} funnel
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {cluster.exampleKeywords?.map(
                        (keyword, keywordIndex) => (
                          <Badge key={keywordIndex} variant="secondary">
                            {keyword}
                          </Badge>
                        )
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      <span className="text-muted-foreground">SERP target: </span>
                      {cluster.serpTarget}
                    </p>
                    <div className="mt-3">
                      <SaveToContentStudioButton
                        auditId={auditId}
                        siteUrl={siteUrl}
                        type="keyword_cluster"
                        title={cluster.cluster}
                        body={{
                          exampleKeywords: cluster.exampleKeywords,
                          funnelStage: cluster.funnelStage,
                          serpTarget: cluster.serpTarget
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="keyword clusters" />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="roadmap" className="mt-5 space-y-4">
          <SectionCard title="90-Day Roadmap">
            {aiInsights.roadmap90Day?.zeroToTwoWeeks?.length ||
            aiInsights.roadmap90Day?.thirtyDays?.length ||
            aiInsights.roadmap90Day?.sixtyToNinetyDays?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "0–2 Weeks", items: aiInsights.roadmap90Day.zeroToTwoWeeks },
                  { label: "30 Days", items: aiInsights.roadmap90Day.thirtyDays },
                  { label: "60–90 Days", items: aiInsights.roadmap90Day.sixtyToNinetyDays }
                ].map((phase) => (
                  <div
                    key={phase.label}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <p className="text-xs font-semibold text-violet-400 uppercase tracking-wide mb-2">
                      {phase.label}
                    </p>
                    <ul className="space-y-2 text-sm text-foreground list-disc list-inside">
                      {(phase.items ?? []).map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="a 90-day roadmap" />
            )}
          </SectionCard>

          <SectionCard title="KPI Framework">
            {aiInsights.kpiFramework?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="pb-2 pr-4 font-medium">Area</th>
                      <th className="pb-2 pr-4 font-medium">Metric</th>
                      <th className="pb-2 pr-4 font-medium">Baseline</th>
                      <th className="pb-2 font-medium">90-Day Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiInsights.kpiFramework.map((kpi, index) => (
                      <tr
                        key={index}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-2 pr-4">
                          <Badge variant="outline">{kpi.area}</Badge>
                        </td>
                        <td className="py-2 pr-4 text-foreground">
                          {kpi.metric}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {kpi.baseline}
                        </td>
                        <td className="py-2 text-foreground">{kpi.target}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState label="a KPI framework" />
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </section>
  )
}
