import { NextResponse } from "next/server"

import { crawlWebsite } from "@/utils/crawler"

export async function POST(req: Request) {

  try {

    const body = await req.json()

    const { url } = body

    if (!url) {

      return NextResponse.json({
        success: false,
        error: "URL is required"
      })

    }

    const result =
      await crawlWebsite(url)

    if (!result.success) {
      return NextResponse.json(
        result,
        {
          status: 400
        }
      )
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {

    console.error(error)

    return NextResponse.json({
      success: false,
      error: String(error)
    })

  }
}
