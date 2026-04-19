import test from "node:test";
import assert from "node:assert/strict";
import { buildNotification } from "../lib/notify.ts";

test("buildNotification: drop uses cha_ching", () => {
  const n = buildNotification({
    name: "Zelda",
    url: "https://bol.com/x",
    oldTotal: 70,
    newTotal: 59.99,
  });
  assert.equal(n.sound, "cha_ching");
  assert.equal(n.title, "Zelda");
  assert.match(n.message, /€70\.00/);
  assert.match(n.message, /€59\.99/);
  assert.equal(n.open_url, "https://bol.com/x");
  assert.equal(n.interruption_level, "time-sensitive");
});

test("buildNotification: rise uses warm_soft_error", () => {
  const n = buildNotification({
    name: "X",
    url: "https://example.com",
    oldTotal: 10,
    newTotal: 12.5,
  });
  assert.equal(n.sound, "warm_soft_error");
});

test("buildNotification: passes through image_url when given", () => {
  const n = buildNotification({
    name: "X",
    url: "https://example.com",
    oldTotal: 10,
    newTotal: 9,
    imageUrl: "https://example.com/img.jpg",
  });
  assert.equal(n.image_url, "https://example.com/img.jpg");
});
