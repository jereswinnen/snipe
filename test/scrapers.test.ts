import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bolScraper } from "../lib/scrapers/bol.ts";
import { coolblueScraper } from "../lib/scrapers/coolblue.ts";
import { allYourGamesScraper } from "../lib/scrapers/allyourgames.ts";
import { nedgameScraper } from "../lib/scrapers/nedgame.ts";
import { shopFromUrl, getScraper } from "../lib/scrapers/index.ts";

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

test("nedgame scraper extracts name + price from fixture", () => {
  const html = readFileSync("test/fixtures/nedgame.html", "utf8");
  const r = nedgameScraper.scrape(html, "https://www.nedgame.nl/x");
  assert.ok(r.name.length > 0);
  assert.ok(r.price > 0);
});

test("shopFromUrl detects hostnames", () => {
  assert.equal(shopFromUrl("https://www.bol.com/nl/nl/p/x/123/"), "bol");
  assert.equal(shopFromUrl("https://bol.com/p/x"), "bol");
  assert.equal(shopFromUrl("https://www.coolblue.be/nl/product/x"), "coolblue");
  assert.equal(shopFromUrl("https://www.coolblue.nl/product/x"), "coolblue");
  assert.equal(shopFromUrl("https://www.allyourgames.nl/x"), "allyourgames");
  assert.equal(shopFromUrl("https://www.nedgame.nl/x"), "nedgame");
  assert.equal(shopFromUrl("https://example.com/"), null);
});

test("getScraper returns scraper per shop", () => {
  assert.equal(getScraper("bol").shop, "bol");
  assert.equal(getScraper("nedgame").shop, "nedgame");
});
