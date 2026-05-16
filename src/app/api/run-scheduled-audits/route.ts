import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { crawlWebsite } from "@/utils/crawler"

export async function GET() {

  try {

    const { data: websites, error } =
      await supabase
        .from("monitored_websites")
        .select("*")

    if (error) {

      return NextResponse.json(
        {
          success: false,
          error: error.message
        },
        {
          status: 500
        }
      )

    }

    const results = []

    for (const website of websites || []) {

      try {

        console.log(
          "Running scheduled audit:",
          website.url
        )

        const auditResult =
          await crawlWebsite(
            website.url
          )

        await supabase
          .from("monitored_websites")
          .update({
            last_audited_at:
              new Date().toISOString()
          })
          .eq("id", website.id)

        results.push({

          website: website.url,

          success:
            auditResult.success

        })

      } catch (error) {

        console.error(error)

        results.push({

          website: website.url,

          success: false

        })

      }

    }

    return NextResponse.json({

      success: true,

      total:
        websites?.length || 0,

      results

    })

  } catch (error) {

    console.error(error)

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to run scheduled audits"
      },
      {
        status: 500
      }
    )

  }

}