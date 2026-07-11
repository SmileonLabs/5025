import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedOrigin, rateLimit, requireProductionSecurityConfig } from "./security";

test("production CORS only accepts configured origins", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOrigins = process.env.ALLOWED_ORIGINS;
  process.env.NODE_ENV = "production";
  process.env.ALLOWED_ORIGINS = "https://bible-wallet.replit.app,capacitor://localhost";
  try {
    assert.equal(isAllowedOrigin("https://bible-wallet.replit.app"), true);
    assert.equal(isAllowedOrigin("capacitor://localhost"), true);
    assert.equal(isAllowedOrigin("https://attacker.example"), false);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    process.env.ALLOWED_ORIGINS = previousOrigins;
  }
});

test("production rejects missing or weak session secrets", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSecret = process.env.SESSION_SECRET;
  const previousOrigins = process.env.ALLOWED_ORIGINS;
  process.env.NODE_ENV = "production";
  process.env.ALLOWED_ORIGINS = "https://bible-wallet.replit.app";
  process.env.SESSION_SECRET = "short";
  try {
    assert.throws(() => requireProductionSecurityConfig(), /SESSION_SECRET/);
    process.env.SESSION_SECRET = "x".repeat(48);
    assert.doesNotThrow(() => requireProductionSecurityConfig());
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    process.env.SESSION_SECRET = previousSecret;
    process.env.ALLOWED_ORIGINS = previousOrigins;
  }
});

test("rate limiter blocks attempts after the configured maximum", () => {
  const middleware = rateLimit({ prefix: `test-${Date.now()}`, windowMs: 60_000, max: 2 });
  const statuses: number[] = [];
  const request = {
    ip: "127.0.0.1",
    socket: {},
    body: { email: "parent@example.com" },
  } as never;
  const response = {
    setHeader() {},
    status(code: number) {
      statuses.push(code);
      return this;
    },
    json() {},
  } as never;
  let passed = 0;
  middleware(request, response, () => { passed += 1; });
  middleware(request, response, () => { passed += 1; });
  middleware(request, response, () => { passed += 1; });
  assert.equal(passed, 2);
  assert.deepEqual(statuses, [429]);
});
