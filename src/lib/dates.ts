const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Today's date in Beirut as YYYY-MM-DD. */
export function todayInBeirut() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut" }).format(new Date());
}

/** The Beirut calendar day (YYYY-MM-DD) of a stored timestamp. */
export function dayInBeirut(timestamp: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut" }).format(new Date(timestamp));
}

/**
 * "9 October", or "29 January 2027" when the year differs from this year.
 * LIVBRID writing rule: months written out.
 */
export function formatDay(iso: string | null | undefined, { withYear = false } = {}) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const thisYear = Number(todayInBeirut().slice(0, 4));
  const showYear = withYear || y !== thisYear;
  return `${d} ${MONTHS[m - 1]}${showYear ? ` ${y}` : ""}`;
}

/** "October 2026" for a month stored as its first day. */
export function formatMonth(iso: string) {
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function daysBetween(fromIso: string, toIso: string) {
  const a = Date.parse(fromIso.slice(0, 10) + "T00:00:00Z");
  const b = Date.parse(toIso.slice(0, 10) + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}
