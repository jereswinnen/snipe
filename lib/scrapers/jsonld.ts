export type JsonLdProduct = {
  name?: string;
  price?: number;
  image?: string;
  sellerName?: string;
};

function coercePrice(p: unknown): number | undefined {
  if (typeof p === "number") return p;
  if (typeof p === "string") {
    const n = Number(p.replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function firstOffer(offers: unknown): Record<string, unknown> | undefined {
  if (!offers) return undefined;
  if (Array.isArray(offers)) return offers[0] as Record<string, unknown> | undefined;
  if (typeof offers === "object") return offers as Record<string, unknown>;
  return undefined;
}

function priceFromOffer(offer: Record<string, unknown> | undefined): number | undefined {
  if (!offer) return undefined;
  return (
    coercePrice(offer.price) ??
    coercePrice(offer.lowPrice) ??
    coercePrice(offer.highPrice)
  );
}

function sellerFromOffer(offer: Record<string, unknown> | undefined): string | undefined {
  const seller = offer?.seller as Record<string, unknown> | undefined;
  return typeof seller?.name === "string" ? (seller.name as string) : undefined;
}

function coerceImage(img: unknown): string | undefined {
  if (!img) return undefined;
  if (typeof img === "string") return img;
  if (Array.isArray(img)) return coerceImage(img[0]);
  if (typeof img === "object") {
    const o = img as Record<string, unknown>;
    if (typeof o.url === "string") return o.url;
    if (typeof o["@id"] === "string") return o["@id"];
  }
  return undefined;
}

function nodesFromBlob(blob: unknown): unknown[] {
  if (!blob) return [];
  if (Array.isArray(blob)) return blob.flatMap(nodesFromBlob);
  if (typeof blob === "object") {
    const o = blob as Record<string, unknown>;
    if (Array.isArray(o["@graph"])) return [...nodesFromBlob(o["@graph"]), o];
    return [o];
  }
  return [];
}

function nodeType(node: Record<string, unknown>): string[] {
  const t = node["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
}

function isProductLike(node: unknown): node is Record<string, unknown> {
  if (!node || typeof node !== "object") return false;
  const types = nodeType(node as Record<string, unknown>);
  return types.includes("Product") || types.includes("ProductGroup");
}

const SCRIPT_RE =
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

/**
 * Some shops (allyourgames.nl) embed customer-review HTML inside a JSON
 * string and leave raw newlines/tabs in it, which is illegal JSON. This
 * pass walks the text with a tiny string/escape state machine and replaces
 * bare control chars inside string literals with their escaped form, so
 * JSON.parse can still handle them.
 */
export function sanitizeJsonControlChars(s: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) {
        out += c;
        escaped = false;
        continue;
      }
      if (c === "\\") {
        out += c;
        escaped = true;
        continue;
      }
      if (c === '"') {
        out += c;
        inString = false;
        continue;
      }
      const code = c.charCodeAt(0);
      if (c === "\n") out += "\\n";
      else if (c === "\r") out += "\\r";
      else if (c === "\t") out += "\\t";
      else if (code < 0x20)
        out += "\\u" + code.toString(16).padStart(4, "0");
      else out += c;
      continue;
    }
    if (c === '"') {
      inString = true;
    }
    out += c;
  }
  return out;
}

function pickVariant(
  variants: Record<string, unknown>[],
  pageUrl: string | undefined,
): Record<string, unknown> {
  if (pageUrl) {
    // Bol ProductGroup pages end with .../<long-numeric-id>/ — match that against variant IDs.
    const idMatch = pageUrl.match(/\/(\d{8,})(?:[/?#]|$)/);
    if (idMatch) {
      const targetId = idMatch[1];
      const byId = variants.find((v) => {
        const pid = typeof v.productID === "string" ? v.productID : null;
        const atId = typeof v["@id"] === "string" ? v["@id"] : null;
        return pid === targetId || (atId != null && atId.includes(targetId));
      });
      if (byId) return byId;
    }
    // Fallback: match by canonical URL.
    const canonical = pageUrl.split("?")[0].replace(/\/$/, "");
    const byUrl = variants.find((v) => {
      const vUrl = typeof v.url === "string" ? v.url.split("?")[0].replace(/\/$/, "") : null;
      return vUrl === canonical;
    });
    if (byUrl) return byUrl;
  }
  return variants[0];
}

function extractFromNode(
  n: Record<string, unknown>,
  pageUrl: string | undefined,
): JsonLdProduct | null {
  const types = nodeType(n);
  let offer = firstOffer(n.offers);
  let price = priceFromOffer(offer);
  let seller = sellerFromOffer(offer);
  let name = typeof n.name === "string" ? n.name : undefined;
  let image = coerceImage(n.image);

  // ProductGroup: pick the variant whose ID matches the page URL, else the first variant.
  if (types.includes("ProductGroup") && Array.isArray(n.hasVariant) && n.hasVariant.length > 0) {
    const variants = n.hasVariant as Record<string, unknown>[];
    const variant = pickVariant(variants, pageUrl);
    const variantOffer = firstOffer(variant.offers);
    const variantPrice = priceFromOffer(variantOffer);
    const variantSeller = sellerFromOffer(variantOffer);
    if (variantPrice != null) price = variantPrice;
    if (variantSeller) seller = variantSeller;
    const variantName = typeof variant.name === "string" ? variant.name : undefined;
    if (variantName) name = variantName;
    const variantImage = coerceImage(variant.image);
    if (variantImage) image = variantImage;
    offer = variantOffer ?? offer;
  }

  if (price == null && !name) return null;
  return { name, price, image, sellerName: seller };
}

/**
 * Convenience for connectors whose whole scrape is "extract JSON-LD, fail
 * if name or price is missing". Returns a narrowed type with both fields
 * guaranteed, so the caller doesn't have to null-check them.
 */
export function requireJsonLd(
  html: string,
  pageUrl: string,
  shop: string,
): JsonLdProduct & { name: string; price: number } {
  const ld = extractProductJsonLd(html, pageUrl);
  if (!ld || ld.price == null || !ld.name) {
    throw new Error(`${shop}: JSON-LD Product not found`);
  }
  return { ...ld, name: ld.name, price: ld.price };
}

export function extractProductJsonLd(
  html: string,
  pageUrl?: string,
): JsonLdProduct | null {
  const matches = html.matchAll(SCRIPT_RE);
  for (const m of matches) {
    const text = m[1].trim();
    if (!text) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      try {
        parsed = JSON.parse(sanitizeJsonControlChars(text));
      } catch {
        continue;
      }
    }
    for (const node of nodesFromBlob(parsed)) {
      if (!isProductLike(node)) continue;
      const r = extractFromNode(node as Record<string, unknown>, pageUrl);
      if (r) return r;
    }
  }
  return null;
}
