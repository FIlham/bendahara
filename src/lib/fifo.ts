/**
 * Pure FIFO allocation helpers (no server imports — safe to import anywhere).
 * Payments are pooled and consumed by periods in order, so a surplus
 * automatically covers earlier shortfalls.
 */
export interface DuePeriod {
  nominal: number;
}

export function allocateFIFO(
  periods: DuePeriod[],
  totalPaid: number,
): { lunas: number; kurang: number } {
  let pool = totalPaid;
  let lunas = 0;
  for (const p of periods) {
    if (pool >= p.nominal) {
      pool -= p.nominal;
      lunas++;
    }
  }
  const due = periods.reduce((s, p) => s + p.nominal, 0);
  return { lunas, kurang: Math.max(0, due - totalPaid) };
}

export interface OpenedPeriod {
  openedAt: Date;
}

/**
 * Index of the first period a user owes: the period active at registration.
 * Users registered before all periods owe from the first one.
 */
export function userStartIndex(
  periods: OpenedPeriod[],
  createdAt: Date,
): number {
  let idx = 0;
  const t = new Date(createdAt).getTime();
  periods.forEach((p, i) => {
    if (new Date(p.openedAt).getTime() <= t) idx = i;
  });
  return idx;
}
