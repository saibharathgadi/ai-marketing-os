"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

type PendingInvite = {
  inviteId: string
  orgName: string
}

/**
 * Surfaces the one real gap in the invite flow: handle_new_user only
 * auto-joins an invite on a BRAND NEW signup. A person who already has
 * a Verolyx account (e.g. the same login already running one workspace,
 * invited into a second) has no other way to accept — see
 * /api/team/invites/accept's GET/POST for the matching logic this
 * banner is a UI for.
 */
export default function PendingInviteBanner() {

  const router = useRouter()

  const [invite, setInvite] =
    useState<PendingInvite | null>(null)

  const [accepting, setAccepting] =
    useState(false)

  const [dismissed, setDismissed] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  useEffect(() => {

    fetch("/api/team/invites/accept")
      .then((response) => response.json())
      .then((result) => {
        if (result.success && result.data) {
          setInvite(result.data)
        }
      })
      .catch((err) => console.error(err))

  }, [])

  async function handleAccept() {

    if (!invite) return

    setAccepting(true)
    setError(null)

    try {

      const response =
        await fetch("/api/team/invites/accept", {
          method: "POST"
        })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || "Failed to accept the invite.")
        return
      }

      setInvite(null)
      router.refresh()

    } catch (err) {

      console.error(err)
      setError("Failed to accept the invite.")

    } finally {

      setAccepting(false)

    }

  }

  if (!invite || dismissed) {
    return null
  }

  return (

    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">

      <div>

        <p className="text-sm font-medium text-foreground">
          You&apos;ve been invited to join {invite.orgName}
        </p>

        {error && (
          <p className="text-sm text-red-400 mt-1">
            {error}
          </p>
        )}

      </div>

      <div className="flex items-center gap-2 shrink-0">

        <Button
          variant="outline"
          size="sm"
          onClick={() => setDismissed(true)}
          disabled={accepting}
        >
          Not now
        </Button>

        <Button
          size="sm"
          onClick={handleAccept}
          disabled={accepting}
        >
          {accepting ? "Joining…" : "Accept invite"}
        </Button>

      </div>

    </div>

  )

}
