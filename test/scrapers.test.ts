import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bol } from "../lib/scrapers/bol.ts";
import { coolblue } from "../lib/scrapers/coolblue.ts";
import { allYourGames } from "../lib/scrapers/allyourgames.ts";
import { nedgame } from "../lib/scrapers/nedgame.ts";
import { dreamland } from "../lib/scrapers/dreamland.ts";
import { shopFromUrl, getConnector } from "../lib/scrapers/index.ts";

test("bol connector extracts name + price from fixture", async () => {
  const html = readFileSync("test/fixtures/bol.html", "utf8");
  const r = await bol.scrape(html, "https://www.bol.com/nl/nl/p/x/12345/");
  assert.ok(r.name.length > 0, `got name: ${r.name}`);
  assert.ok(r.price > 0, `got price: ${r.price}`);
  assert.equal(typeof r.soldByBol, "boolean");
});

test("coolblue connector extracts name + price from fixture", async () => {
  const html = readFileSync("test/fixtures/coolblue.html", "utf8");
  const r = await coolblue.scrape(html, "https://www.coolblue.be/nl/product/x");
  assert.ok(r.name.length > 0);
  assert.ok(r.price > 0);
});

test("allyourgames connector extracts name + price from fixture", async () => {
  const html = readFileSync("test/fixtures/allyourgames.html", "utf8");
  const r = await allYourGames.scrape(html, "https://www.allyourgames.nl/x");
  assert.ok(r.name.length > 0);
  assert.ok(r.price > 0);
});

test("nedgame connector extracts name + price from fixture", async () => {
  const html = readFileSync("test/fixtures/nedgame.html", "utf8");
  const r = await nedgame.scrape(html, "https://www.nedgame.nl/x");
  assert.ok(r.name.length > 0);
  assert.ok(r.price > 0);
});

test("dreamland connector extracts name + price from fixture", async () => {
  const html = readFileSync("test/fixtures/dreamland.html", "utf8");
  const r = await dreamland.scrape(
    html,
    "https://www.dreamland.be/nl/producten/ps5-pragmata/02347813",
  );
  assert.ok(r.name.length > 0);
  assert.ok(r.price > 0);
  assert.ok(r.imageUrl && r.imageUrl.length > 0);
});

test("shopFromUrl detects hostnames", () => {
  assert.equal(shopFromUrl("https://www.bol.com/nl/nl/p/x/123/"), "bol");
  assert.equal(shopFromUrl("https://bol.com/p/x"), "bol");
  assert.equal(shopFromUrl("https://www.coolblue.be/nl/product/x"), "coolblue");
  assert.equal(shopFromUrl("https://www.coolblue.nl/product/x"), "coolblue");
  assert.equal(shopFromUrl("https://www.allyourgames.nl/x"), "allyourgames");
  assert.equal(shopFromUrl("https://www.nedgame.nl/x"), "nedgame");
  assert.equal(
    shopFromUrl("https://www.nintendo.com/nl-be/Games/x-123.html"),
    "nintendo",
  );
  assert.equal(
    shopFromUrl("https://www.dreamland.be/nl/producten/x/12345"),
    "dreamland",
  );
  assert.equal(shopFromUrl("https://example.com/"), null);
});

test("getConnector returns connector per shop", () => {
  assert.equal(getConnector("bol").shop, "bol");
  assert.equal(getConnector("nedgame").shop, "nedgame");
  assert.equal(getConnector("nintendo").shop, "nintendo");
  assert.equal(getConnector("nintendo").medium, "digital");
});
