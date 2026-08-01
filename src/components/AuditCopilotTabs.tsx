"use client"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

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
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
      <h3 className="text-sm font-semibold text-zinc-200 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="text-sm text-zinc-500">
      No {label} generated for this audit yet.
    </p>
  )
}

export default function AuditCopilotTabs({
  aiInsights
}: {
  aiInsights: AIInsights
}) {
  const contentIdeas = aiInsights.contentIdeas || []
  const blogIdeas = contentIdeas.filter((idea) => idea.type === "blog")
  const landingIdeasFromContent = contentIdeas.filter(
    (idea) => idea.type === "landing-page"
  )

  return (
    <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-3xl font-bold">AI Marketing Copilot</h2>
        <Badge variant={aiInsights.source === "ai" ? "default" : "outline"}>
          {aiInsights.source === "ai"
            ? "AI generated"
            : "Rule-based (no AI key configured)"}
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList variant="line" className="border-b border-zinc-800 pb-0">
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
            <p className="text-sm text-zinc-300">
              {aiInsights.executiveSummary}
            </p>
          </SectionCard>

          <SectionCard title="Weekly Focus">
            <p className="text-sm text-zinc-300">{aiInsights.weeklyFocus}</p>
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
                      <p className="text-sm font-medium text-zinc-100">
                        {action.title}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
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
                    <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
                      <th className="pb-2 pr-4 font-medium">Issue</th>
                      <th className="pb-2 pr-4 font-medium">Type</th>
                      <th className="pb-2 font-medium">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiInsights.rootCauseSummary.map((row, index) => (
                      <tr
                        key={index}
                        className="border-b border-zinc-900 last:border-0"
                      >
                        <td className="py-2 pr-4 text-zinc-200">
                          {row.issue}
                        </td>
                        <td className="py-2 pr-4 text-zinc-500">
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
                <p className="text-xs text-zinc-500 mb-2">Opportunities</p>
                <ul className="space-y-1.5 text-sm text-zinc-300 list-disc list-inside">
                  {aiInsights.marketingOpportunities?.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-2">Detected Themes</p>
                <div className="flex flex-wrap gap-2">
                  {aiInsights.detectedThemes?.length ? (
                    aiInsights.detectedThemes.map((theme, index) => (
                      <Badge key={index} variant="outline">
                        {theme}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-zinc-500">
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
                    className="rounded-lg border border-zinc-800 bg-zinc-900 p-3"
                  >
                    <Badge variant="secondary">{idea.type}</Badge>
                    <p className="text-sm font-medium mt-2">{idea.title}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {idea.description}
                    </p>
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
                    className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                  >
                    <p className="text-sm font-semibold">
                      {series.seriesTitle}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {series.description}
                    </p>
                    <ol className="mt-3 space-y-1.5 text-sm text-zinc-300 list-decimal list-inside">
                      {series.posts?.map((post, postIndex) => (
                        <li key={postIndex}>
                          {post.title}{" "}
                          <span className="text-zinc-500">
                            — {post.angle}
                          </span>
                        </li>
                      ))}
                    </ol>
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
                    className="rounded-lg border border-zinc-800 bg-zinc-900 p-3"
                  >
                    <Badge variant="secondary">{idea.platform}</Badge>
                    <p className="text-sm mt-2">{idea.idea}</p>
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
                    className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
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
                          <span className="font-medium text-zinc-100">
                            {post.hook}
                          </span>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {post.caption}
                          </p>
                        </li>
                      ))}
                    </ul>
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
                    className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                  >
                    <p className="text-sm font-semibold">{campaign.name}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {campaign.objective}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm text-zinc-300">
                      <p>
                        <span className="text-zinc-500">Audience: </span>
                        {campaign.targetAudience}
                      </p>
                      <p>
                        <span className="text-zinc-500">Key message: </span>
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
                    className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm"
                  >
                    <p className="font-medium text-zinc-100">
                      {adSet.campaignName}
                    </p>
                    <p className="text-zinc-400 mt-2">
                      <span className="text-zinc-500">Audience angle: </span>
                      {adSet.audienceAngle}
                    </p>
                    <p className="text-zinc-400 mt-1">
                      <span className="text-zinc-500">Creative angle: </span>
                      {adSet.creativeAngle}
                    </p>
                    <p className="text-zinc-400 mt-1">
                      <span className="text-zinc-500">Budget split: </span>
                      {adSet.suggestedBudgetSplit}
                    </p>
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
                    className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                  >
                    <p className="text-sm font-semibold">{page.title}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {page.targetOffer}
                    </p>
                    <div className="mt-3 space-y-2">
                      {page.sections?.map((section, sectionIndex) => (
                        <div
                          key={sectionIndex}
                          className="rounded-md bg-zinc-950 border border-zinc-800 p-3"
                        >
                          <p className="text-sm font-medium text-zinc-100">
                            {section.name}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1">
                            {section.purpose}
                          </p>
                          <p className="text-xs text-zinc-400 mt-1 italic">
                            &ldquo;{section.copyHint}&rdquo;
                          </p>
                        </div>
                      ))}
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
                    className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
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
                    <p className="text-xs text-zinc-500 mt-3">
                      <span className="text-zinc-400">SERP target: </span>
                      {cluster.serpTarget}
                    </p>
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
                    className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                  >
                    <p className="text-xs font-semibold text-violet-400 uppercase tracking-wide mb-2">
                      {phase.label}
                    </p>
                    <ul className="space-y-2 text-sm text-zinc-300 list-disc list-inside">
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
                    <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
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
                        className="border-b border-zinc-900 last:border-0"
                      >
                        <td className="py-2 pr-4">
                          <Badge variant="outline">{kpi.area}</Badge>
                        </td>
                        <td className="py-2 pr-4 text-zinc-200">
                          {kpi.metric}
                        </td>
                        <td className="py-2 pr-4 text-zinc-500">
                          {kpi.baseline}
                        </td>
                        <td className="py-2 text-zinc-200">{kpi.target}</td>
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
