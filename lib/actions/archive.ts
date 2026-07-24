"use server";

import { createClient } from "@/lib/supabase/server";

export type ArchiveGroupBy = "date" | "vendor" | "user";
export type ArchiveDateOrder = "newest" | "oldest";

export type ArchiveReceipt = {
  id: string;
  vendor: string;
  total_amount: number;
  created_at: string;
  purchased_at: string | null;
  user_id: string | null;
  uploader_name: string | null;
  event_id: string;
  event_name: string;
};

export type ArchiveQuery = {
  query?: string;
  groupBy: ArchiveGroupBy;
  dateOrder: ArchiveDateOrder;
  offset?: number;
  limit?: number;
};

const PAGE_SIZE = 40;

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** CZ datum: 1.7.2026 / 01.07.2026 */
function parseCzechDate(raw: string): { from: string; to: string } | null {
  const m = raw.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const from = new Date(Date.UTC(year, month - 1, day));
  const to = new Date(Date.UTC(year, month - 1, day + 1));
  if (Number.isNaN(from.getTime())) return null;
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Stránkované doklady celé firmy — volá se až z klientského archivu.
 * Bez image_url (fotky až na vyžádání).
 */
export async function getArchiveReceiptsAction(
  params: ArchiveQuery
): Promise<{ rows: ArchiveReceipt[]; hasMore: boolean; error?: string }> {
  const limit = Math.min(Math.max(params.limit ?? PAGE_SIZE, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);
  const q = (params.query ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { rows: [], hasMore: false, error: "Nejste přihlášeni." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return { rows: [], hasMore: false, error: "Profil nenalezen." };
  }

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, name")
    .eq("company_id", profile.company_id);

  if (eventsError) {
    return { rows: [], hasMore: false, error: eventsError.message };
  }

  const eventIds = (events ?? []).map((e) => e.id);
  if (eventIds.length === 0) {
    return { rows: [], hasMore: false };
  }

  const eventNameById = new Map((events ?? []).map((e) => [e.id, e.name]));

  // Řazení podle režimu: datum / dodavatel / uživatel
  let ascending = false;
  let orderColumn: "purchased_at" | "created_at" | "vendor" | "uploader_name" =
    "purchased_at";

  if (params.groupBy === "date") {
    ascending = params.dateOrder === "oldest";
    orderColumn = "purchased_at";
  } else if (params.groupBy === "vendor") {
    ascending = true;
    orderColumn = "vendor";
  } else {
    ascending = true;
    orderColumn = "uploader_name";
  }

  let request = supabase
    .from("receipts")
    .select(
      "id, vendor, total_amount, created_at, purchased_at, user_id, uploader_name, event_id"
    )
    .in("event_id", eventIds);

  if (q) {
    const amount = parseAmount(q);
    const dateRange = parseCzechDate(q);

    if (amount !== null) {
      // ±0.01 kvůli float / čárkám
      request = request
        .gte("total_amount", amount - 0.005)
        .lte("total_amount", amount + 0.005);
    } else if (dateRange) {
      // Filtr přes created_at; purchased_at se dofiltruje na klientu u zobrazení
      request = request
        .gte("created_at", dateRange.from)
        .lt("created_at", dateRange.to);
    } else {
      const safe = q.replace(/[%_,()]/g, " ").trim();
      if (safe) {
        const pattern = `%${safe}%`;
        request = request.or(
          `vendor.ilike.${pattern},uploader_name.ilike.${pattern}`
        );
      }
    }
  }

  // Primární order + stabilní secondary
  if (orderColumn === "purchased_at") {
    request = request
      .order("purchased_at", {
        ascending,
        nullsFirst: false,
      })
      .order("created_at", { ascending });
  } else if (orderColumn === "vendor") {
    request = request
      .order("vendor", { ascending: true })
      .order("created_at", { ascending: false });
  } else {
    request = request
      .order("uploader_name", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
  }

  const { data, error } = await request.range(offset, offset + limit - 1);

  if (error) {
    return { rows: [], hasMore: false, error: error.message };
  }

  const rows: ArchiveReceipt[] = (data ?? []).map((r) => ({
    id: r.id,
    vendor: r.vendor,
    total_amount: Number(r.total_amount),
    created_at: r.created_at,
    purchased_at: r.purchased_at,
    user_id: r.user_id,
    uploader_name: r.uploader_name,
    event_id: r.event_id,
    event_name: eventNameById.get(r.event_id) ?? "Akce",
  }));

  // Datumový filtr: pokud user zadal CZ datum, nech jen matching purchased_at/created_at den
  let filtered = rows;
  if (q && parseCzechDate(q) && parseAmount(q) === null) {
    const m = q.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      const year = Number(m[3]);
      filtered = rows.filter((r) => {
        const iso = r.purchased_at ?? r.created_at;
        const d = new Date(iso);
        return (
          d.getFullYear() === year &&
          d.getMonth() + 1 === month &&
          d.getDate() === day
        );
      });
    }
  }

  return {
    rows: filtered,
    hasMore: (data ?? []).length >= limit,
  };
}
