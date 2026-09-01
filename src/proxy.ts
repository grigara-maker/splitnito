import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // /api/ocr se ověřuje v route handleru; Proxy by navíc kopírovala celý upload.
    // /api/qr a /api/cron volají e-mailoví klienti a Vercel Cron bez session.
    "/((?!api/ocr(?:/|$)|api/qr(?:/|$)|api/cron(?:/|$)|api/email-preview(?:/|$)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
