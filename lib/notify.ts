export type NotificationPayload = {
  title: string;
  message: string;
  open_url: string;
  sound: "cha_ching" | "warm_soft_error";
  image_url?: string;
  interruption_level: "passive" | "active" | "time-sensitive";
};

export function buildNotification(input: {
  name: string;
  url: string;
  oldTotal: number;
  newTotal: number;
  imageUrl?: string;
}): NotificationPayload {
  const fmt = (n: number) => `€${n.toFixed(2)}`;
  return {
    title: input.name,
    message: `${fmt(input.oldTotal)} → ${fmt(input.newTotal)}`,
    open_url: input.url,
    sound: input.newTotal < input.oldTotal ? "cha_ching" : "warm_soft_error",
    image_url: input.imageUrl,
    interruption_level: "time-sensitive",
  };
}

const hoursFmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function buildScrapeFailureNotification(input: {
  name: string;
  shop: string;
  error: string;
  openUrl: string;
  imageUrl?: string;
}): NotificationPayload {
  // Trim the error so the push body stays short. Keep the first line,
  // strip any trailing diagnostic parens, clamp to ~120 chars.
  const firstLine = input.error.split("\n")[0].trim();
  const cleaned = firstLine.replace(/\s*\([^)]*\)\s*$/, "").slice(0, 120);
  return {
    title: `Scrape failed · ${input.shop}`,
    message: `${input.name} — ${cleaned}`,
    open_url: input.openUrl,
    sound: "warm_soft_error",
    image_url: input.imageUrl,
    interruption_level: "passive",
  };
}

export function buildSaleEndingNotification(input: {
  name: string;
  url: string;
  endsAt: Date;
  salePrice: number;
  regularPrice: number;
  imageUrl?: string;
}): NotificationPayload {
  const fmt = (n: number) => `€${n.toFixed(2)}`;
  const hoursLeft = Math.max(
    1,
    Math.round((input.endsAt.getTime() - Date.now()) / 3_600_000),
  );
  const when =
    hoursLeft >= 20 ? hoursFmt.format(1, "day") : hoursFmt.format(hoursLeft, "hour");
  return {
    title: `Sale ending ${when}`,
    message: `${input.name} — ${fmt(input.salePrice)} (was ${fmt(input.regularPrice)})`,
    open_url: input.url,
    sound: "cha_ching",
    image_url: input.imageUrl,
    interruption_level: "time-sensitive",
  };
}

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const { env } = await import("@/lib/env");
  const res = await fetch("https://api.brrr.now/v1/send", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${env.BRRR_WEBHOOK_SECRET}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`brrr.now ${res.status}: ${await res.text().catch(() => "")}`);
  }
}
