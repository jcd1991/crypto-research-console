import { afterEach, describe, expect, it } from "vitest";
import { get } from "./freqtradeLab.js";

const originalUrl = process.env.FREQTRADE_API_URL;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.FREQTRADE_API_URL;
  else process.env.FREQTRADE_API_URL = originalUrl;
});

describe("freqtrade lab provider", () => {
  it("rejects non-loopback API URLs", async () => {
    process.env.FREQTRADE_API_URL = "https://example.com";
    await expect(get("/api/v1/health")).rejects.toThrow("localhost-only");
  });

  it("rejects control routes before making a request", async () => {
    process.env.FREQTRADE_API_URL = "http://127.0.0.1:8080";
    await expect(get("/api/v1/forceenter")).rejects.toThrow("unsupported Freqtrade route");
  });
});
