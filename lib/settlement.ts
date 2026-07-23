export type SettlementMember = {
  userId: string;
  name: string;
  iban: string | null;
  /** Čistý příspěvek do vyúčtování = výdaje − tržby */
  paid: number;
  expenses: number;
  revenues: number;
  share: number;
  balance: number;
};

export type PaymentStatus = "pending" | "confirmed";

export type SettlementTransfer = {
  id: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  toIban: string | null;
  amount: number;
  status: PaymentStatus;
};

export type SettlementSummary = {
  /** Čistý součet (výdaje − tržby) — základ pro podíl */
  totalAmount: number;
  totalExpenses: number;
  totalRevenues: number;
  memberCount: number;
  averageShare: number;
  members: SettlementMember[];
  transfers: SettlementTransfer[];
  allPaid: boolean;
};

export function transferKey(t: {
  fromUserId: string;
  toUserId: string;
  amount: number;
}): string {
  return `${t.fromUserId}:${t.toUserId}:${t.amount.toFixed(2)}`;
}

/**
 * Férové dělení mezi uživateli (equal split).
 *
 * Každý člen má:
 *   expenses = součet dokladů
 *   revenues = součet tržeb, které si vzal domů
 *   paid     = expenses − revenues  (čistý příspěvek)
 *
 * Podíl = Σ paid / počet členů
 * balance = paid − podíl
 *   > 0 → má dostat (přeplatil / méně tržeb)
 *   < 0 → má doplatit (nebo si vzal víc tržeb)
 */
export function calculateSettlement(
  members: {
    userId: string;
    name: string;
    iban: string | null;
    expenses?: number;
    revenues?: number;
    /** Legacy: pokud chybí expenses, ber paid jako výdaje */
    paid?: number;
  }[]
): SettlementSummary {
  const memberCount = members.length;
  const normalized = members.map((m) => {
    const expenses = roundMoney(
      m.expenses ?? (m.paid != null ? Number(m.paid) : 0)
    );
    const revenues = roundMoney(m.revenues ?? 0);
    return {
      userId: m.userId,
      name: m.name,
      iban: m.iban,
      expenses,
      revenues,
      paid: roundMoney(expenses - revenues),
    };
  });

  const totalExpenses = roundMoney(
    normalized.reduce((sum, m) => sum + m.expenses, 0)
  );
  const totalRevenues = roundMoney(
    normalized.reduce((sum, m) => sum + m.revenues, 0)
  );
  const totalAmount = roundMoney(
    normalized.reduce((sum, m) => sum + m.paid, 0)
  );
  const averageShare = memberCount === 0 ? 0 : totalAmount / memberCount;

  const settledMembers: SettlementMember[] = normalized.map((m) => ({
    ...m,
    share: averageShare,
    balance: roundMoney(m.paid - averageShare),
  }));

  const debtors = settledMembers
    .filter((m) => m.balance < -0.005)
    .map((m) => ({ ...m, remaining: Math.abs(m.balance) }))
    .sort((a, b) => b.remaining - a.remaining);

  const creditors = settledMembers
    .filter((m) => m.balance > 0.005)
    .map((m) => ({ ...m, remaining: m.balance }))
    .sort((a, b) => b.remaining - a.remaining);

  const transfers: SettlementTransfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = roundMoney(
      Math.min(debtors[i].remaining, creditors[j].remaining)
    );
    if (amount > 0) {
      transfers.push({
        id: transferKey({
          fromUserId: debtors[i].userId,
          toUserId: creditors[j].userId,
          amount,
        }),
        fromUserId: debtors[i].userId,
        fromName: debtors[i].name,
        toUserId: creditors[j].userId,
        toName: creditors[j].name,
        toIban: creditors[j].iban,
        amount,
        status: "pending",
      });
    }
    debtors[i].remaining = roundMoney(debtors[i].remaining - amount);
    creditors[j].remaining = roundMoney(creditors[j].remaining - amount);
    if (debtors[i].remaining <= 0.005) i += 1;
    if (creditors[j].remaining <= 0.005) j += 1;
  }

  return {
    totalAmount: roundMoney(totalAmount),
    totalExpenses,
    totalRevenues,
    memberCount,
    averageShare: roundMoney(averageShare),
    members: settledMembers,
    transfers,
    allPaid: transfers.length === 0,
  };
}

export function normalizeSettlementSummary(raw: unknown): SettlementSummary {
  const data = raw as Partial<SettlementSummary> & {
    transfers?: Array<Partial<SettlementTransfer> & {
      fromUserId: string;
      toUserId: string;
      amount: number;
    }>;
  };

  const transfers: SettlementTransfer[] = (data.transfers ?? []).map((t) => ({
    id:
      t.id ??
      transferKey({
        fromUserId: t.fromUserId,
        toUserId: t.toUserId,
        amount: Number(t.amount),
      }),
    fromUserId: t.fromUserId,
    fromName: t.fromName ?? "",
    toUserId: t.toUserId,
    toName: t.toName ?? "",
    toIban: t.toIban ?? null,
    amount: Number(t.amount),
    status: t.status === "confirmed" ? "confirmed" : "pending",
  }));

  const members: SettlementMember[] = (data.members ?? []).map((m) => {
    const expenses = Number(
      m.expenses ?? (m.revenues != null ? Number(m.paid) + Number(m.revenues) : m.paid) ??
        0
    );
    const revenues = Number(m.revenues ?? 0);
    const paid = Number(m.paid ?? expenses - revenues);
    return {
      userId: m.userId,
      name: m.name,
      iban: m.iban ?? null,
      expenses,
      revenues,
      paid,
      share: Number(m.share ?? 0),
      balance: Number(m.balance ?? 0),
    };
  });

  const totalExpenses = Number(
    data.totalExpenses ??
      members.reduce((s, m) => s + m.expenses, 0)
  );
  const totalRevenues = Number(
    data.totalRevenues ??
      members.reduce((s, m) => s + m.revenues, 0)
  );

  return {
    totalAmount: Number(data.totalAmount ?? 0),
    totalExpenses,
    totalRevenues,
    memberCount: Number(data.memberCount ?? members.length),
    averageShare: Number(data.averageShare ?? 0),
    members,
    transfers,
    allPaid:
      typeof data.allPaid === "boolean"
        ? data.allPaid
        : transfers.every((t) => t.status === "confirmed") ||
          transfers.length === 0,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function itemsSum(items: { totalPrice: number }[]): number {
  return roundMoney(items.reduce((s, i) => s + Number(i.totalPrice || 0), 0));
}

export function amountsMismatch(
  itemsTotal: number,
  receiptTotal: number,
  allowedDeviation = 1
): boolean {
  // Varování až když rozdíl překročí povolenou odchylku (výchozí 1 Kč)
  return Math.abs(itemsTotal - receiptTotal) > allowedDeviation;
}

/** Akce je ještě „živá“: otevřená, nebo uzavřená a čeká na platby. */
export function isEventOngoing(
  status: string,
  allPaid: boolean | null | undefined
): boolean {
  if (status === "active") return true;
  if (status !== "closed") return false;
  if (allPaid == null) return true;
  return !allPaid;
}

/** Do historie až po úplném zaplacení. */
export function isEventArchived(
  status: string,
  allPaid: boolean | null | undefined
): boolean {
  return status === "closed" && allPaid === true;
}
