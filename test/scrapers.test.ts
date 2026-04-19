import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bolScraper } from "../lib/scrapers/bol.ts";

test("bol scraper extracts name + price from fixture", () => {
  const html = readFileSync("test/fixtures/bol.html", "utf8");
  const r = bolScraper.scrape(html, "https://www.bol.com/nl/nl/p/x/12345/");
  assert.ok(r.name.length > 0, `got name: ${r.name}`);
  assert.ok(r.price > 0, `got price: ${r.price}`);
  assert.equal(typeof r.soldByBol, "boolean");
});
