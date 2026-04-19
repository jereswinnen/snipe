import test from "node:test";
import assert from "node:assert/strict";
import { extractProductJsonLd } from "../lib/scrapers/jsonld.ts";

const html = `<!doctype html><html><head>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Zelda TOTK",
    "image": "https://example.com/z.jpg",
    "offers": {
      "@type": "Offer",
      "price": "59.99",
      "priceCurrency": "EUR",
      "seller": { "@type": "Organization", "name": "Bol.com" }
    }
  }
  </script>
</head><body></body></html>`;

test("extractProductJsonLd returns name/price/image", () => {
  const r = extractProductJsonLd(html);
  assert.equal(r?.name, "Zelda TOTK");
  assert.equal(r?.price, 59.99);
  assert.equal(r?.image, "https://example.com/z.jpg");
  assert.equal(r?.sellerName, "Bol.com");
});

test("extractProductJsonLd handles array offers", () => {
  const multi = html.replace(
    /"offers":\s*\{[^}]*\}[^}]*\}/s,
    '"offers":[{"@type":"Offer","price":"49.99","priceCurrency":"EUR"}]',
  );
  const r = extractProductJsonLd(multi);
  assert.equal(r?.price, 49.99);
});

test("extractProductJsonLd handles @graph wrapper", () => {
  const wrapped = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Product","name":"X","offers":{"price":"10","priceCurrency":"EUR"}}]}</script>`;
  const r = extractProductJsonLd(wrapped);
  assert.equal(r?.name, "X");
  assert.equal(r?.price, 10);
});

test("extractProductJsonLd returns null when no Product", () => {
  assert.equal(extractProductJsonLd("<html></html>"), null);
});
