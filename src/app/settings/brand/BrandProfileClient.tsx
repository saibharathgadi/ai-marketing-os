"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from "@/components/ui/card"

type BrandProfile = {
  business_description: string | null
  target_audience: string | null
  tone_of_voice: string | null
  key_differentiators: string | null
}

const emptyProfile: BrandProfile = {
  business_description: "",
  target_audience: "",
  tone_of_voice: "",
  key_differentiators: ""
}

export default function BrandProfileClient() {

  const [profile, setProfile] =
    useState<BrandProfile>(emptyProfile)

  const [loading, setLoading] =
    useState(true)

  const [loadError, setLoadError] =
    useState(false)

  const [saving, setSaving] =
    useState(false)

  const [statusMessage, setStatusMessage] =
    useState<string | null>(null)

  useEffect(() => {

    loadProfile()

  }, [])

  async function loadProfile() {

    try {

      const response = await fetch("/api/brand-profile")
      const result = await response.json()

      if (!result.success) {
        setLoadError(true)
        return
      }

      if (result.data) {
        setProfile({
          business_description: result.data.business_description ?? "",
          target_audience: result.data.target_audience ?? "",
          tone_of_voice: result.data.tone_of_voice ?? "",
          key_differentiators: result.data.key_differentiators ?? ""
        })
      }

    } catch (error) {

      console.error(error)
      setLoadError(true)

    } finally {

      setLoading(false)

    }

  }

  async function handleSave() {

    setSaving(true)
    setStatusMessage(null)

    try {

      const response =
        await fetch("/api/brand-profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            businessDescription: profile.business_description,
            targetAudience: profile.target_audience,
            toneOfVoice: profile.tone_of_voice,
            keyDifferentiators: profile.key_differentiators
          })
        })

      const result = await response.json()

      if (!result.success) {
        setStatusMessage(result.error || "Failed to save brand profile.")
        return
      }

      await loadProfile()
      setStatusMessage("Saved.")

    } catch (error) {

      console.error(error)
      setStatusMessage("Failed to save brand profile.")

    } finally {

      setSaving(false)

    }

  }

  function updateField(field: keyof BrandProfile, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  return (

    <main className="relative min-h-screen bg-background text-foreground">

      <div className="max-w-2xl mx-auto px-6 py-16">

        <h1 className="text-3xl font-bold">
          Brand
        </h1>

        <p className="text-muted-foreground mt-2">
          Tell the AI who you are so audits and content ideas sound like
          your business, not a generic one.
        </p>

        {loadError && (
          <p className="mt-4 text-sm text-destructive">
            Failed to load your brand profile.
          </p>
        )}

        {loading ? (

          <p className="text-muted-foreground mt-10">Loading…</p>

        ) : (

          <Card className="rounded-2xl border border-border bg-card p-6 mt-8">

            <CardHeader>
              <CardTitle className="text-xl">
                Brand profile
              </CardTitle>
              <CardDescription>
                Every field is optional — fill in what&apos;s useful. This
                feeds directly into the AI-generated content and campaign
                ideas on your audits.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">

              <div>
                <label className="text-xs text-muted-foreground">
                  What does your business do?
                </label>
                <Textarea
                  value={profile.business_description || ""}
                  onChange={(e) =>
                    updateField("business_description", e.target.value)
                  }
                  placeholder="e.g. We build project management software for construction teams."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">
                  Who is your target audience?
                </label>
                <Textarea
                  value={profile.target_audience || ""}
                  onChange={(e) =>
                    updateField("target_audience", e.target.value)
                  }
                  placeholder="e.g. Small-to-midsize construction contractors and site managers."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">
                  Brand tone &amp; voice
                </label>
                <Textarea
                  value={profile.tone_of_voice || ""}
                  onChange={(e) =>
                    updateField("tone_of_voice", e.target.value)
                  }
                  placeholder="e.g. Direct and practical, avoid jargon, occasional dry humor."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">
                  What makes you different from competitors?
                </label>
                <Textarea
                  value={profile.key_differentiators || ""}
                  onChange={(e) =>
                    updateField("key_differentiators", e.target.value)
                  }
                  placeholder="e.g. Works offline on job sites, no per-seat pricing."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>

                {statusMessage && (
                  <p className="text-sm text-muted-foreground">
                    {statusMessage}
                  </p>
                )}
              </div>

            </CardContent>

          </Card>

        )}

      </div>

    </main>

  )

}
