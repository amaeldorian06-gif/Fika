/** Calendar dates in Cameroon (UTC+1, no DST), inclusive end date. */
export function localDay(now = new Date()): string {
  return new Date(now.getTime() + 3600000).toISOString().slice(0, 10);
}
export function parseReportRange(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if ((from && !valid(from)) || (to && !valid(to)) || (from && to && from > to)) throw new Error('Période invalide. Utilisez des dates valides, dans le bon ordre.');
  if (!from && !to) return undefined;
  return { ...(from ? { gte: new Date(`${from}T00:00:00.000+01:00`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999+01:00`) } : {}) };
}
