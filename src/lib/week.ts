/** Monday 00:00 WIB of the week containing `now`, returned as UTC Date. */
export function startOfWeekWIB(now: Date = new Date()): Date {
  const wib = new Date(now.getTime() + 7 * 3600 * 1000);
  const day = wib.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const mondayWibMidnight = Date.UTC(
    wib.getUTCFullYear(),
    wib.getUTCMonth(),
    wib.getUTCDate() - diffToMonday,
  );
  return new Date(mondayWibMidnight - 7 * 3600 * 1000);
}

export function addWeeks(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 7 * 86400 * 1000);
}
