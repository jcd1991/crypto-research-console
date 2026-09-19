import { afterEach, describe, expect, it, vi } from "vitest";
import { binanceDepth, bybitDepth, okxDepth, snapshotGovernance } from "./intel.js";
import { ethereumHoldings } from "./wallet.js";

afterEach(() => vi.restoreAllMocks());

describe("public intelligence providers", () => {
  it("normalizes Binance depth into spread, depth, and imbalance", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ bids: [["100", "2"]], asks: [["101", "3"]] }), { status: 200 })));
    const result = await binanceDepth("BTC");
    expect(result.mid).toBe(100.5);
    expect(result.spreadBps).toBeGreaterThan(0);
    expect(result.depthUsd.within1Pct).toBe(503);
    expect(result.imbalance).toBeLessThan(0);
  });

  it("parses Bybit order book arrays", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: { b: [["100", "1"]], a: [["100.5", "1"]] } }), { status: 200 })));
    const result = await bybitDepth("ETH");
    expect(result.mid).toBe(100.25);
    expect(result.bids[0]).toEqual([100, 1]);
  });

  it("parses OKX perpetual order book arrays", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "0", data: [{ bids: [["100", "1", "0", "1"]], asks: [["100.5", "2", "0", "1"]] }] }), { status: 200 })));
    const result = await okxDepth("BTC");
    expect(result.mid).toBe(100.25);
    expect(result.depthUsd.within05Pct).toBe(301);
  });

  it("uses a valid Snapshot GraphQL query shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { proposals: [] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await snapshotGovernance("lido-snapshot.eth");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.variables.spaces).toEqual(["lido-snapshot.eth"]);
    expect(body.query).toContain('orderBy:"created"');
  });

  it("normalizes a public EVM wallet into native and ERC-20 holdings", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ coin_balance: "1000000000000000000", exchange_rate: "2500" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ token: { address_hash: "0xabc", symbol: "USDC", name: "USD Coin", decimals: "6", exchange_rate: "1" }, value: "1234500" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await ethereumHoldings("0xF977814e90dA44bFA03b6295A0616a897441aceC");
    expect(result.native.valueUsd).toBe(2500);
    expect(result.holdings[0]).toMatchObject({ symbol: "USDC", amount: 1.2345, valueUsd: 1.2345 });
  });
});
