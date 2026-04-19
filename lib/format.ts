export const money = (n: number | string) =>
  `€${Number(n).toFixed(2).replace(".", ",")}`;

const TZ = "Europe/Brussels";

const dateTimeFmt = new Intl.DateTimeFormat("nl-BE", {
  timeZone: TZ,
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const when = typeof d === "string" ? new Date(d) : d;
  return dateTimeFmt.format(when);
}

export function relativeTime(d: Date | string | null | undefined): string {
  if (!d) return "never";
  const when = typeof d === "string" ? new Date(d) : d;
  const diffMs = Date.now() - when.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
