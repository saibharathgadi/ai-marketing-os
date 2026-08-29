import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/utils/organizations"
import { getAuditQueueSnapshot } from "@/utils/auditQueue"

export async function GET() {

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  if (!orgId) {
    return NextResponse.json(
      {
        success: false,
        error: "Authentication required."
      },
      {
        status: 401
      }
    )
  }

  // The underlying snapshot is global queue/failure-rate metadata, not
  // scoped to any one org — safe for any authenticated user to see in
  // aggregate. activeUrls is deliberately excluded below: it contains
  // literal "orgId:url" lock keys for every organization's in-flight
  // audits, which would otherwise leak cross-tenant data to the client.
  const snapshot = await getAuditQueueSnapshot()

  return NextResponse.json({
    success: true,
    queue: {
      active: snapshot.active,
      running: snapshot.running,
      queued: snapshot.queued,
      failed: snapshot.failed,
      failedByReason: snapshot.failedByReason,
      maxActive: snapshot.maxActive,
      maxQueued: snapshot.maxQueued
    }
  })
}
