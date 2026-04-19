import test from "node:test";
import assert from "node:assert/strict";
import { shippingCost } from "../lib/shipping.ts";

test("bol sold-by-third-party is 0", () => {
  assert.equal(shippingCost("bol", 10, { soldByBol: false }), 0);
  assert.equal(shippingCost("bol", 100, { soldByBol: false }), 0);
});

test("bol sold-by-bol under 25 is 2.99", () => {
  assert.equal(shippingCost("bol", 20, { soldByBol: true }), 2.99);
  assert.equal(shippingCost("bol", 24.99, { soldByBol: true }), 2.99);
});

test("bol sold-by-bol at or above 25 is free", () => {
  assert.equal(shippingCost("bol", 25, { soldByBol: true }), 0);
  assert.equal(shippingCost("bol", 99, { soldByBol: true }), 0);
});

test("bol with unknown seller defaults to sold-by-bol rules (conservative)", () => {
  assert.equal(shippingCost("bol", 10, { soldByBol: null }), 2.99);
});

test("coolblue is always free", () => {
  assert.equal(shippingCost("coolblue", 1, {}), 0);
  assert.equal(shippingCost("coolblue", 999, {}), 0);
});

test("allyourgames uses flat configured rate", () => {
  assert.equal(shippingCost("allyourgames", 30, {}, { allYourGamesFlat: 5.95 }), 5.95);
  assert.equal(shippingCost("allyourgames", 30, {}, { allYourGamesFlat: 4.5 }), 4.5);
});

test("nedgame pre-order is free", () => {
  assert.equal(shippingCost("nedgame", 60, { isPreOrder: true }), 0);
});

test("nedgame under 175 is 6.99", () => {
  assert.equal(shippingCost("nedgame", 30, { isPreOrder: false }), 6.99);
  assert.equal(shippingCost("nedgame", 174.99, { isPreOrder: false }), 6.99);
});

test("nedgame at or above 175 is free", () => {
  assert.equal(shippingCost("nedgame", 175, { isPreOrder: false }), 0);
  assert.equal(shippingCost("nedgame", 300, { isPreOrder: false }), 0);
});
