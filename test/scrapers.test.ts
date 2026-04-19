import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bolScraper } from "../lib/scrapers/bol.ts";
import { coolblueScraper } from "../lib/scrapers/coolblue.ts";
import { allYourGamesScraper } from "../lib/scrapers/allyourgames.ts";

test("bol scraper extracts name + price from fixture", () => {
  const html = readFileSync("test/fixtures/bol.html", "utf8");
  const r = bolScraper.scrape(html, "https://www.bol.com/nl/nl/p/x/12345/");
  assert.ok(r.name.length > 0, `got name: ${r.name}`);
  assert.ok(r.price > 0, `got price: ${r.price}`);
  assert.equal(typeof r.soldByBol, "boolean");
});

test("coolblue scraper extracts name + price from fixture", () => {
  const html = readFileSync("test/fixtures/coolblue.html", "utf8");
  const r = coolblueScraper.scrape(html, "https://www.coolblue.be/nl/product/x");
  assert.ok(r.name.length > 0);
  assert.ok(r.price > 0);
});

test("allyourgames scraper extracts name + price from fixture", () => {
  const html = readFileSync("test/fixtures/allyourgames.html", "utf8");
  const r = allYourGamesScraper.scrape(html, "https://www.allyourgames.nl/x");
  assert.ok(r.name.length > 0);
  assert.ok(r.price > 0);
});
