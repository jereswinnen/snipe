import { connect } from "node:http2";
import { importPKCS8, SignJWT } from "jose";
import { env } from "@/lib/env";
import { deleteDeviceByToken, listDevices } from "@/lib/db/queries";
import type { NotificationPayload } from "@/lib/notify";

type ApnsEnvironment = "sandbox" | "production";

type ApnsPayload = {
  aps: {
    alert: { title: string; body: string };
    sound?: string;
    "thread-id"?: string;
    "interruption-level"?: "passive" | "active" | "time-sensitive";
    "mutable-content"?: 1;
  };
  // Custom keys are forwarded verbatim; the iOS app reads them.
  [key: string]: unknown;
};

type ApnsSendResult = {
  ok: boolean;
  status: number;
  reason?: string;
};

let cachedJwt: { token: string; expiresAt: number } | null = null;

function apnsConfigured(): boolean {
  return (
    env.APNS_KEY_P8.length > 0 &&
    env.APNS_KEY_ID.length > 0 &&
    env.APNS_TEAM_ID.length > 0 &&
    env.APNS_BUNDLE_ID.length > 0
  );
}

async function getAuthToken(): Promise<string> {
  // APNs JWTs must be rotated within 1 hour; refresh at 55 minutes.
  if (cachedJwt && cachedJwt.expiresAt > Date.now()) return cachedJwt.token;
  const key = await importPKCS8(env.APNS_KEY_P8, "ES256");
  const iat = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ iss: env.APNS_TEAM_ID, iat })
    .setProtectedHeader({ alg: "ES256", kid: env.APNS_KEY_ID })
    .sign(key);
  cachedJwt = { token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return token;
}

/**
 * Sends one APNs push. Handles HTTP/2, JWT, and parses the reason on
 * failure. Does not retry — callers are expected to call once per token.
 */
export async function sendApnsPush(opts: {
  environment: ApnsEnvironment;
  deviceToken: string;
  payload: ApnsPayload;
}): Promise<ApnsSendResult> {
  const host =
    opts.environment === "production"
      ? "api.push.apple.com"
      : "api.sandbox.push.apple.com";
  const jwt = await getAuthToken();

  return new Promise((resolve) => {
    const client = connect(`https://${host}:443`);
    const body = JSON.stringify(opts.payload);
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${opts.deviceToken}`,
      "apns-topic": env.APNS_BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      authorization: `bearer ${jwt}`,
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body).toString(),
    });

    let status = 0;
    let data = "";
    req.on("response", (h) => {
      status = Number(h[":status"]) || 0;
    });
    req.on("data", (c: Buffer | string) => {
      data += typeof c === "string" ? c : c.toString("utf8");
    });
    req.on("end", () => {
      client.close();
      if (status === 200) {
        resolve({ ok: true, status });
      } else {
        let reason: string | undefined;
        try {
          reason = JSON.parse(data).reason;
        } catch {
          /* ignore */
        }
        resolve({ ok: false, status, reason });
      }
    });
    req.on("error", () => {
      client.close();
      resolve({ ok: false, status: 0, reason: "network" });
    });

    req.write(body);
    req.end();
  });
}

/**
 * Fans out a notification to every registered device. Same content as the
 * brrr push path, translated into APNs' envelope. Silently no-ops if APNs
 * isn't configured (lets local dev run without the Apple keys). Prunes
 * tokens that APNs reports as unregistered (410 Gone).
 */
export async function fanoutApnsNotification(
  payload: NotificationPayload,
): Promise<void> {
  if (!apnsConfigured()) return;
  const devices = await listDevices();
  if (devices.length === 0) return;

  const apnsPayload: ApnsPayload = {
    aps: {
      alert: { title: payload.title, body: payload.message },
      sound: payload.sound === "warm_soft_error" ? "default" : "default",
      "interruption-level": payload.interruption_level,
      // mutable-content lets the iOS Notification Service Extension
      // download `image_url` and attach it as a thumbnail before the
      // banner is shown. No-op when image_url is absent.
      ...(payload.image_url ? { "mutable-content": 1 as const } : {}),
    },
    open_url: payload.open_url,
    ...(payload.image_url ? { image_url: payload.image_url } : {}),
  };

  const results = await Promise.all(
    devices.map((d) =>
      sendApnsPush({
        environment: d.environment,
        deviceToken: d.apnsToken,
        payload: apnsPayload,
      }).then((r) => ({ device: d, result: r })),
    ),
  );

  for (const { device, result } of results) {
    // 410 Gone: token no longer valid. Also 400 BadDeviceToken when the
    // token's env doesn't match; treat both as prunable to keep the table
    // clean.
    if (result.status === 410 || result.reason === "BadDeviceToken") {
      await deleteDeviceByToken(device.apnsToken);
    } else if (!result.ok) {
      console.error(
        `apns send failed (device ${device.id}): ${result.status} ${result.reason ?? ""}`,
      );
    }
  }
}
