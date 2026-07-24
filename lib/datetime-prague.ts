const PRAGUE = "Europe/Prague";

export type PragueParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Civilní datum/čas v Europe/Prague → ISO UTC (pro DB timestamptz).
 * Odolné vůči DST.
 */
export function pragueWallTimeToIso(parts: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
}): string {
  const hour = parts.hour ?? 12;
  const minute = parts.minute ?? 0;
  const second = parts.second ?? 0;

  let utcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    hour,
    minute,
    second
  );

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PRAGUE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let i = 0; i < 4; i++) {
    const got = formatter.formatToParts(new Date(utcMs));
    const num = (type: Intl.DateTimeFormatPartTypes) =>
      Number(got.find((p) => p.type === type)?.value ?? "0");

    const asUtcGuess = Date.UTC(
      num("year"),
      num("month") - 1,
      num("day"),
      num("hour"),
      num("minute"),
      num("second")
    );
    const desired = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      hour,
      minute,
      second
    );
    const diff = desired - asUtcGuess;
    utcMs += diff;
    if (diff === 0) break;
  }

  return new Date(utcMs).toISOString();
}

/**
 * OCR / volný text času z účtenky.
 * Čas na dokladu bereme jako Europe/Prague — ignorujeme Z/+00:00 od modelu
 * (jinak 15:00 → 17:00 při letním čase).
 */
export function parseReceiptPurchasedAt(
  raw: string | null | undefined
): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();

  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i
  );
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const hour = m[4] != null ? Number(m[4]) : 12;
    const minute = m[5] != null ? Number(m[5]) : 0;
    const second = m[6] != null ? Number(m[6]) : 0;
    if (
      !year ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour > 23 ||
      minute > 59
    ) {
      return null;
    }
    return pragueWallTimeToIso({ year, month, day, hour, minute, second });
  }

  // CZ: 15.7.2026 15:30 / 15.07.2026
  const cz = s.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (cz) {
    return pragueWallTimeToIso({
      year: Number(cz[3]),
      month: Number(cz[2]),
      day: Number(cz[1]),
      hour: cz[4] != null ? Number(cz[4]) : 12,
      minute: cz[5] != null ? Number(cz[5]) : 0,
      second: cz[6] != null ? Number(cz[6]) : 0,
    });
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function formatInPrague(
  iso: string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: PRAGUE,
    ...options,
  }).format(new Date(iso));
}

export function formatDateTimeInPrague(iso: string): {
  date: string;
  time: string;
} {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { date: "—", time: "—" };
  }
  return {
    date: formatInPrague(iso, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    time: formatInPrague(iso, {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

/** Pro `<input type="datetime-local">` — civilní čas v Praze. */
export function toDatetimeLocalInPrague(isoOrDate: string | Date): string {
  const d =
    typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PRAGUE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Hodnota z datetime-local (bez timezone) → ISO UTC jako Prague wall time.
 */
export function datetimeLocalPragueToIso(local: string): string | null {
  const m = local
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return pragueWallTimeToIso({
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
    second: m[6] != null ? Number(m[6]) : 0,
  });
}
