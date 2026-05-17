import { NextResponse } from "next/server"
import { getAuditQueueSnapshot } from "@/utils/auditQueue"

export async function GET() {
  return NextResponse.json({
    success: true,
    queue: getAuditQueueSnapshot()
  })
}
