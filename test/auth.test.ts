import test from "node:test";
import assert from "node:assert/strict";
import { signSession, verifySession } from "../lib/auth.ts";

const SECRET = "a".repeat(64);

test("signSession and verifySession roundtrip", () => {
  const token = signSession(SECRET, Date.now());
  assert.equal(verifySession(SECRET, token), true);
});

test("verifySession rejects tampered token", () => {
  const token = signSession(SECRET, Date.now());
  const tampered = token.slice(0, -2) + (token.at(-2) === "a" ? "bb" : "aa");
  assert.equal(verifySession(SECRET, tampered), false);
});

test("verifySession rejects expired token", () => {
  const oneYearAgo = Date.now() - 366 * 24 * 60 * 60 * 1000;
  const token = signSession(SECRET, oneYearAgo);
  assert.equal(verifySession(SECRET, token), false);
});

test("verifySession rejects malformed input", () => {
  assert.equal(verifySession(SECRET, ""), false);
  assert.equal(verifySession(SECRET, "garbage"), false);
  assert.equal(verifySession(SECRET, "a.b"), false);
});
