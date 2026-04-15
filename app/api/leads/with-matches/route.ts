import { NextResponse } from "next/server";
import { getBestPGsForLead } from "@/lib/matchService";

export async function GET(req: Request) {
  try {
    const leadsRes = await fetch(new URL("/api/leads", req.url), {
      cache: "no-store",
      headers: {
        cookie: req.headers.get("cookie") || "",
      },
    });

    const pgsRes = await fetch(new URL("/api/properties", req.url), {
      cache: "no-store",
      headers: {
        cookie: req.headers.get("cookie") || "",
      },
    });

    const leadsData = await leadsRes.json();
    const pgsData = await pgsRes.json();

    const leads = Array.isArray(leadsData)
      ? leadsData
      : leadsData.data || [];

    const pgs = Array.isArray(pgsData)
      ? pgsData
      : pgsData.data || [];

    const result = leads.map((lead: any) => {
      const matches = getBestPGsForLead(lead, pgs);

      return {
        ...lead,
        bestPGs: matches.top3,
        morePGs: matches.next3,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Matching failed" },
      { status: 500 }
    );
  }
}