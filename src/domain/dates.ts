export function localDate(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((v) => v.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function addDays(date: string, days: number) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
export function dayNumber(start: string, date: string) {
  return Math.max(
    1,
    Math.min(
      30,
      Math.round((Date.parse(date) - Date.parse(start)) / 86400000) + 1,
    ),
  );
}

export function programExpired(start: string, date: string) {
  return date >= addDays(start, 30);
}
