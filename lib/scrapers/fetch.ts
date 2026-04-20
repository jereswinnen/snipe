// One of these is picked per retry. Kept current (Chrome 131, Safari 17.4)
// and rotated so Akamai-style fingerprinting can't pin a single UA per IP.
const BROWSERS: Array<{
  userAgent: string;
  secChUa: string;
  platform: string;
}> = [
  {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    secChUa:
      '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    platform: '"macOS"',
  },
  {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    secChUa:
      '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    platform: '"Windows"',
  },
  {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    secChUa: "",
    platform: '"macOS"',
  },
];

function buildHeaders(
  browser: (typeof BROWSERS)[number],
  url: string,
): Record<string, string> {
  const host = new URL(url).host;
  const h: Record<string, string> = {
    "User-Agent": browser.userAgent,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "nl-BE,nl;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Cache-Control": "max-age=0",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    // Intentionally no Referer — a constant google.com referer from a
    // datacenter IP is itself a bot signal. Browsers opening a bookmarked
    // or directly-typed URL send no Referer at all.
  };
  if (browser.secChUa) {
    h["Sec-Ch-Ua"] = browser.secChUa;
    h["Sec-Ch-Ua-Mobile"] = "?0";
    h["Sec-Ch-Ua-Platform"] = browser.platform;
  }
  // bol.com serves cookies on first visit that subsequent pages expect.
  // We don't have a session, so matching-host Referer on retries looks
  // more like "clicked an internal link" than "dropped in from Google".
  if (host.endsWith("bol.com")) {
    h["Referer"] = `https://${host}/`;
  }
  return h;
}

export function canonicalizeUrl(input: string): string {
  try {
    const u = new URL(input);
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return input;
  }
}

export async function fetchPage(url: string, attempts = 3): Promise<string> {
  const target = canonicalizeUrl(url);
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const browser = BROWSERS[i % BROWSERS.length];
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch(target, {
        headers: buildHeaders(browser, target),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${target}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
