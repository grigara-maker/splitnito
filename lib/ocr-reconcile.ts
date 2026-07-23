import type { ReceiptItem } from "@/lib/types/database";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function itemsSum(items: { totalPrice: number }[]): number {
  return round2(items.reduce((s, i) => s + Number(i.totalPrice || 0), 0));
}

function optionKey(unit: number, total: number): string {
  return `${round2(unit)}|${round2(total)}`;
}

/**
 * Pro řádek s quantity > 1 může být zobrazená cena buď za kus, nebo za celý řádek.
 * Vygeneruje kandidáty a později se vybere kombinace nejbližší totalAmount.
 */
function lineOptions(item: ReceiptItem): ReceiptItem[] {
  const quantity =
    Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
  const unit = Number(item.unitPrice);
  const total = Number(item.totalPrice);

  const seen = new Set<string>();
  const out: ReceiptItem[] = [];

  const add = (unitPrice: number, totalPrice: number) => {
    if (!Number.isFinite(unitPrice) || !Number.isFinite(totalPrice)) return;
    if (unitPrice < 0 || totalPrice < 0) return;
    const u = round2(unitPrice);
    const t = round2(totalPrice);
    const key = optionKey(u, t);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      name: item.name,
      quantity,
      unitPrice: u,
      totalPrice: t,
    });
  };

  // Původní hodnoty (opravená aritmetika oběma směry)
  if (Number.isFinite(unit) && unit > 0) {
    add(unit, unit * quantity); // zobrazená = cena/ks
  }
  if (Number.isFinite(total) && total > 0) {
    add(total / quantity, total); // zobrazená = cena řádku
  }
  // AI někdy omylem vydělí cenu/ks počtem → unit je moc malé, total = původní cena/ks
  if (Number.isFinite(total) && total > 0 && quantity > 1) {
    add(total, total * quantity);
  }
  // AI někdy vynásobí řádkovou cenu → total je moc velké
  if (Number.isFinite(unit) && unit > 0 && quantity > 1) {
    add(unit / quantity, unit);
  }

  if (out.length === 0) {
    return [
      {
        name: item.name,
        quantity,
        unitPrice: round2(Number.isFinite(unit) ? unit : 0),
        totalPrice: round2(
          Number.isFinite(total)
            ? total
            : (Number.isFinite(unit) ? unit : 0) * quantity
        ),
      },
    ];
  }

  return out;
}

/**
 * Vybere interpretaci položek (cena/ks vs. cena řádku) tak, aby součet
 * co nejlépe seděl na celkovou cenu dokladu.
 */
export function reconcileOcrItemsWithTotal(
  items: ReceiptItem[],
  totalAmount: number | null | undefined,
  tolerance = 1.5
): ReceiptItem[] {
  if (!items.length) return items;

  const target =
    totalAmount != null && Number.isFinite(Number(totalAmount))
      ? round2(Number(totalAmount))
      : null;

  const optionLists = items.map(lineOptions);

  // Bez celkové ceny: aspoň sjednoť unit ↔ total (preferuj konzistentní souč)
  if (target == null) {
    return items.map((item, i) => {
      const opts = optionLists[i];
      // Preferuj variantu, kde |unit*qty - total| je 0
      const exact = opts.find(
        (o) => Math.abs(o.unitPrice * o.quantity - o.totalPrice) < 0.02
      );
      return exact ?? opts[0] ?? item;
    });
  }

  const currentSum = itemsSum(items);
  const currentDiff = Math.abs(currentSum - target);
  if (currentDiff <= tolerance) {
    // I při shodě oprav drobné unit/total nesoulady
    return items.map((item, i) => {
      const opts = optionLists[i];
      const match = opts.find(
        (o) =>
          Math.abs(o.totalPrice - item.totalPrice) < 0.02 &&
          Math.abs(o.unitPrice * o.quantity - o.totalPrice) < 0.02
      );
      return match ?? item;
    });
  }

  let comboCount = 1;
  for (const opts of optionLists) {
    comboCount *= Math.max(opts.length, 1);
  }

  let best = items;
  let bestDiff = currentDiff;

  const consider = (candidate: ReceiptItem[]) => {
    const diff = Math.abs(itemsSum(candidate) - target);
    if (diff + 1e-9 < bestDiff) {
      bestDiff = diff;
      best = candidate;
    }
  };

  if (comboCount <= 4096) {
    const dfs = (index: number, acc: ReceiptItem[]) => {
      if (index === optionLists.length) {
        consider(acc);
        return;
      }
      for (const opt of optionLists[index]) {
        dfs(index + 1, [...acc, opt]);
      }
    };
    dfs(0, []);
  } else {
    // Beam / greedy: po jedné položce zkus všechny varianty
    let current = [...items];
    for (let i = 0; i < optionLists.length; i++) {
      let localBest = current;
      let localDiff = Math.abs(itemsSum(current) - target);
      for (const opt of optionLists[i]) {
        const trial = current.map((it, j) => (j === i ? opt : it));
        const diff = Math.abs(itemsSum(trial) - target);
        if (diff + 1e-9 < localDiff) {
          localDiff = diff;
          localBest = trial;
        }
      }
      current = localBest;
    }
    consider(current);
  }

  return best;
}

export function ocrItemsSum(items: ReceiptItem[]): number {
  return itemsSum(items);
}
