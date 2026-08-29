"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu"
import { ChevronDownIcon } from "lucide-react"

type Organization = {
  orgId: string
  role: string
  orgName: string
}

/**
 * Renders nothing for the vast majority of users, who belong to exactly
 * one organization — this only becomes visible once a login is a member
 * of more than one, which today means the temporary Phase 1 multi-org
 * gate is active for at least one of their memberships.
 */
export default function WorkspaceSwitcher() {

  const router = useRouter()

  const [organizations, setOrganizations] =
    useState<Organization[]>([])

  const [activeOrgId, setActiveOrgId] =
    useState<string | null>(null)

  const [switching, setSwitching] =
    useState(false)

  useEffect(() => {

    fetch("/api/workspace")
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          setOrganizations(result.data.organizations)
          setActiveOrgId(result.data.activeOrgId)
        }
      })
      .catch((error) => console.error(error))

  }, [])

  if (organizations.length <= 1) {
    return null
  }

  const activeOrg =
    organizations.find((org) => org.orgId === activeOrgId)

  async function handleSwitch(orgId: string) {

    if (orgId === activeOrgId) return

    setSwitching(true)

    try {

      const response =
        await fetch("/api/workspace/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId })
        })

      const result = await response.json()

      if (!result.success) {
        console.error(result.error)
        return
      }

      router.push("/dashboard")
      router.refresh()

    } catch (error) {

      console.error(error)

    } finally {

      setSwitching(false)

    }

  }

  return (

    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition"
          disabled={switching}
        >
          {activeOrg?.orgName ?? "Workspace"}
          <ChevronDownIcon className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.orgId}
            onClick={() => handleSwitch(org.orgId)}
          >
            {org.orgName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>

  )

}
