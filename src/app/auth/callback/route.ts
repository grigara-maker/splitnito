import { NextResponse } from "next/server";

import {
  clearPendingAppleSetup,
  getPendingAppleSetup,
} from "@/lib/auth/apple-pending";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  const base =
    !isLocal && forwardedHost ? `https://${forwardedHost}` : origin;

  if (!code) {
    return NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent(
        "Přihlášení přes Apple se nezdařilo. Zkuste to znovu."
      )}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    await clearPendingAppleSetup();
    return NextResponse.redirect(
      `${base}/login?error=${encodeURIComponent(
        "Přihlášení přes Apple se nezdařilo. Zkuste to znovu."
      )}`
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await clearPendingAppleSetup();
    return NextResponse.redirect(`${base}/login`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    await clearPendingAppleSetup();
    const destination = next.startsWith("/onboarding") ? "/dashboard" : next;
    return NextResponse.redirect(`${base}${destination}`);
  }

  // Nový Apple účet — dokonči setup z registrace (cookie), jinak onboarding
  const pending = await getPendingAppleSetup();
  if (pending) {
    const displayName =
      pending.accountType === "company"
        ? (pending.companyName ?? pending.name ?? "Firma")
        : (pending.name ?? "Uživatel");

    const { error: setupError } = await supabase.rpc("complete_user_setup", {
      p_name: displayName,
      p_iban: pending.accountType === "member" ? pending.iban : null,
      p_invite_code:
        pending.accountType === "member" ? pending.inviteCode : null,
      p_company_name:
        pending.accountType === "company" ? pending.companyName : null,
      p_role: pending.accountType === "company" ? "company" : "member",
    });

    await clearPendingAppleSetup();

    if (setupError) {
      const inviteQ = pending.inviteCode
        ? `?invite=${encodeURIComponent(pending.inviteCode)}&error=${encodeURIComponent(setupError.message)}`
        : `?error=${encodeURIComponent(setupError.message)}`;
      return NextResponse.redirect(`${base}/onboarding${inviteQ}`);
    }

    return NextResponse.redirect(`${base}/dashboard`);
  }

  const destination = next.startsWith("/onboarding") ? next : "/onboarding";
  return NextResponse.redirect(`${base}${destination}`);
}
