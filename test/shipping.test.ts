import test from "node:test";
import assert from "node:assert/strict";
import { shippingCost } from "../lib/shipping.ts";

test("bol is always free", () => {
  assert.equal(shippingCost("bol", 10, { soldByBol: false }), 0);
  assert.equal(shippingCost("bol", 100, { soldByBol: true }), 0);
  assert.equal(shippingCost("bol", 10, { soldByBol: null }), 0);
});

test("coolblue is always free", () => {
  assert.equal(shippingCost("coolblue", 1, {}), 0);
  assert.equal(shippingCost("coolblue", 999, {}), 0);
});

test("allyourgames uses flat configured rate", () => {
  assert.equal(shippingCost("allyourgames", 30, {}, { allYourGamesFlat: 5.95 }), 5.95);
  assert.equal(shippingCost("allyourgames", 30, {}, { allYourGamesFlat: 4.5 }), 4.5);
});

test("nintendo digital is always free", () => {
  assert.equal(shippingCost("nintendo", 1, {}), 0);
  assert.equal(shippingCost("nintendo", 59.99, {}), 0);
});

test("dreamland under 50 is 4.99", () => {
  assert.equal(shippingCost("dreamland", 20, {}), 4.99);
  assert.equal(shippingCost("dreamland", 49.99, {}), 4.99);
});

test("dreamland at or above 50 is free", () => {
  assert.equal(shippingCost("dreamland", 50, {}), 0);
  assert.equal(shippingCost("dreamland", 200, {}), 0);
});
