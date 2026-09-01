import type { NextRequest } from "next/server";

import {
  eventSummaryEmail,
  paymentReceivedEmail,
  paymentRequestEmail,
} from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Náhled e-mailových šablon při vývoji: /api/email-preview?type=summary */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const type = request.nextUrl.searchParams.get("type") ?? "request";
  const reminder = Number(request.nextUrl.searchParams.get("reminder") ?? 0);

  const shared = {
    companyName: "Grigar Events",
    eventName: "Letní festival Náměšť",
    eventUrl: "https://splitnito.fun/events/demo",
  };

  const email =
    type === "received"
      ? paymentReceivedEmail({
          ...shared,
          recipientName: "Bao Linh",
          counterpartyName: "Adam Grigar",
          amount: 4820.5,
          actionUrl: "https://splitnito.fun/p/demo",
          reminderIndex: reminder,
        })
      : type === "summary"
        ? eventSummaryEmail({
            ...shared,
            recipientName: "Adam Grigar",
            closedAt: new Date().toISOString(),
            totalExpenses: 38420,
            totalRevenues: 12600,
            totalAmount: 25820,
            averageShare: 8606.67,
            members: [
              {
                name: "Adam Grigar",
                expenses: 18400,
                revenues: 3200,
                share: 8606.67,
                balance: 6593.33,
                isRecipient: true,
              },
              {
                name: "Daniel Grigar",
                expenses: 14020,
                revenues: 6400,
                share: 8606.67,
                balance: -986.67,
                isRecipient: false,
              },
              {
                name: "Bao Linh Ngo",
                expenses: 6000,
                revenues: 3000,
                share: 8606.67,
                balance: -5606.67,
                isRecipient: false,
              },
            ],
            transfers: [
              {
                fromName: "Bao Linh Ngo",
                toName: "Adam Grigar",
                amount: 5606.67,
              },
              {
                fromName: "Daniel Grigar",
                toName: "Adam Grigar",
                amount: 986.66,
              },
            ],
            companyTotals: {
              eventCount: 7,
              expenses: 214300,
              revenues: 88100,
              net: 126200,
            },
          })
        : paymentRequestEmail({
            ...shared,
            recipientName: "Daniel Grigar",
            counterpartyName: "Adam Grigar",
            amount: 4820.5,
            iban: "CZ6508000000192000145399",
            paymentMessage: "Splitnito - Grigar Events - Letní festival",
            qrUrl: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=demo",
            actionUrl: "https://splitnito.fun/p/demo",
            reminderIndex: reminder,
          });

  return new Response(email.html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
