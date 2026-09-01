import type { NextRequest } from "next/server";

import { runReminderSweep } from "@/lib/email/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  return request.nextUrl.searchParams.get("secret") === secret;
}

/** Denní připomínky nedoplacených plateb (Vercel Cron). */
export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runReminderSweep();

  return Response.json({
    ok: true,
    checkedEvents: result.events,
    sent: result.sent,
    skipped: result.skipped,
    failed: result.failed,
  });
}
