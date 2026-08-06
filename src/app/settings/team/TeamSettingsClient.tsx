"use client"

import { useEffect, useState } from "react"
import { formatLocalTimestamp } from "@/lib/date"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from "@/components/ui/table"

type TeamMember = {
  id: string
  user_id: string
  email: string
  role: "owner" | "member"
  created_at: string
}

type TeamInvite = {
  id: string
  email: string
  status: string
  created_at: string
  expires_at: string
}

export default function TeamSettingsClient() {

  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {

    loadTeam()

  }, [])

  async function loadTeam() {

    try {

      const response = await fetch("/api/team")
      const result = await response.json()

      if (!result.success) {
        setLoadError(true)
        return
      }

      setMembers(result.data.members)
      setInvites(result.data.invites)
      setCurrentUserRole(result.data.currentUserRole)

    } catch (error) {

      console.error(error)
      setLoadError(true)

    }

  }

  async function handleInvite() {

    if (!inviteEmail.trim()) return

    setInviteLoading(true)
    setStatusMessage(null)

    try {

      const response =
        await fetch("/api/team/invites", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email: inviteEmail.trim() })
        })

      const result = await response.json()

      if (!result.success) {
        setStatusMessage(
          result.error || "Failed to send invite."
        )

        return
      }

      await loadTeam()
      setInviteEmail("")

      setStatusMessage(
        result.emailSent
          ? "Invite sent."
          : "Invite created, but the invite email couldn't be sent."
      )

    } catch (error) {

      console.error(error)
      setStatusMessage("Failed to send invite.")

    } finally {

      setInviteLoading(false)

    }

  }

  async function handleRevokeInvite(id: string) {

    try {

      const response =
        await fetch(`/api/team/invites/${id}`, {
          method: "DELETE"
        })

      const result = await response.json()

      if (!result.success) {
        setStatusMessage(
          result.error || "Failed to revoke invite."
        )

        return
      }

      await loadTeam()
      setStatusMessage("Invite revoked.")

    } catch (error) {

      console.error(error)

    }

  }

  async function handleRemoveMember(id: string) {

    const confirmed = confirm("Remove this team member?")

    if (!confirmed) return

    try {

      const response =
        await fetch(`/api/team/members/${id}`, {
          method: "DELETE"
        })

      const result = await response.json()

      if (!result.success) {
        setStatusMessage(
          result.error || "Failed to remove team member."
        )

        return
      }

      await loadTeam()
      setStatusMessage("Team member removed.")

    } catch (error) {

      console.error(error)

    }

  }

  const isOwner = currentUserRole === "owner"

  return (

    <main className="relative min-h-screen bg-background text-foreground">

      <div className="max-w-2xl mx-auto px-6 py-16">

        <h1 className="text-3xl font-bold">
          Team
        </h1>

        <p className="text-muted-foreground mt-2">
          Manage who has access to your Verolyx organization.
        </p>

        {loadError && (
          <p className="mt-4 text-sm text-destructive">
            Failed to load team information.
          </p>
        )}

        <Card className="rounded-2xl border border-border bg-card p-6 mt-8">

          <CardHeader>
            <CardTitle className="text-xl">
              Members
            </CardTitle>
          </CardHeader>

          <CardContent>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  {isOwner && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          member.role === "owner"
                            ? "default"
                            : "outline"
                        }
                      >
                        {member.role === "owner" ? "Owner" : "Member"}
                      </Badge>
                    </TableCell>
                    {isOwner && (
                      <TableCell>
                        {member.role === "member" && (
                          <Button
                            onClick={() =>
                              handleRemoveMember(member.id)
                            }
                            variant="destructive"
                            size="sm"
                          >
                            Remove
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

          </CardContent>

        </Card>

        {isOwner && (

          <Card className="rounded-2xl border border-border bg-card p-6 mt-6">

            <CardHeader>

              <CardTitle className="text-xl">
                Invite a teammate
              </CardTitle>

              <CardDescription>
                They&apos;ll join your organization automatically when
                they sign up with this email address.
              </CardDescription>

            </CardHeader>

            <CardContent>

              <div className="flex flex-col md:flex-row gap-4">

                <input
                  type="email"
                  placeholder="teammate@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 rounded-xl bg-background border border-border px-4 py-3 outline-none focus:border-violet-500"
                />

                <Button
                  onClick={handleInvite}
                  disabled={inviteLoading}
                  className="h-auto py-3 px-6"
                >
                  {inviteLoading ? "Sending…" : "Send Invite"}
                </Button>

              </div>

              {statusMessage && (
                <p className="text-sm text-muted-foreground mt-4">
                  {statusMessage}
                </p>
              )}

              {invites.length > 0 && (

                <div className="mt-6 space-y-3">

                  <p className="text-sm font-medium text-foreground">
                    Pending invites
                  </p>

                  {invites.map((invite) => (

                    <div
                      key={invite.id}
                      className="rounded-xl bg-background p-4 flex items-center justify-between gap-4"
                    >

                      <div>

                        <p className="text-sm text-foreground">
                          {invite.email}
                        </p>

                        <p className="text-xs text-muted-foreground mt-1">
                          Sent {formatLocalTimestamp(invite.created_at)}
                        </p>

                      </div>

                      <Button
                        onClick={() => handleRevokeInvite(invite.id)}
                        variant="outline"
                        size="sm"
                      >
                        Revoke
                      </Button>

                    </div>

                  ))}

                </div>

              )}

            </CardContent>

          </Card>

        )}

      </div>

    </main>

  )

}
