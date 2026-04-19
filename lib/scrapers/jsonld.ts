import * as cheerio from "cheerio";

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

function isProduct(node: unknown): node is Record<string, unknown> {
  if (!node || typeof node !== "object") return false;
  const t = (node as Record<string, unknown>)["@type"];
  if (t === "Product") return true;
  if (Array.isArray(t) && t.includes("Product")) return true;
  return false;
}

export function extractProductJsonLd(html: string): JsonLdProduct | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const s of scripts) {
    const text = $(s).contents().text();
    if (!text) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { continue; }
    for (const node of nodesFromBlob(parsed)) {
      if (!isProduct(node)) continue;
      const n = node as Record<string, unknown>;
      const offer = firstOffer(n.offers);
      const price = coercePrice(offer?.price);
      const image = coerceImage(n.image);
      const sellerRaw = offer?.seller as Record<string, unknown> | undefined;
      return {
        name: typeof n.name === "string" ? n.name : undefined,
        price,
        image,
        sellerName: typeof sellerRaw?.name === "string" ? sellerRaw.name as string : undefined,
      };
    }
  }
  return null;
}
