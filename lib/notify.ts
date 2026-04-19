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
