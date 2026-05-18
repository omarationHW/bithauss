import { NextResponse } from "next/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TickerItem {
  label: string;
  value: number;
  change: number; // 24h change %
}

interface CachedPayload {
  ts: number;
  items: TickerItem[];
}

let cache: CachedPayload | null = null;
const TTL_MS = 60_000;

interface CoinGeckoCoin {
  usd: number;
  mxn: number;
  usd_24h_change: number;
  mxn_24h_change: number;
}

interface CoinGeckoResp {
  bitcoin: CoinGeckoCoin;
  ethereum: CoinGeckoCoin;
  "usd-coin": CoinGeckoCoin;
}

interface FrankfurterResp {
  amount: number;
  base: string;
  date: string;
  rates: { MXN: number };
}

async function fetchTicker(): Promise<TickerItem[]> {
  const [cgRes, fxRes] = await Promise.all([
    fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,usd-coin&vs_currencies=usd,mxn&include_24hr_change=true",
      { next: { revalidate: 60 }, headers: { Accept: "application/json" } },
    ),
    fetch("https://api.frankfurter.app/latest?from=EUR&to=MXN", {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    }),
  ]);

  if (!cgRes.ok) {
    throw new Error(`CoinGecko ${cgRes.status}`);
  }

  const cg = (await cgRes.json()) as CoinGeckoResp;
  const fx = fxRes.ok ? ((await fxRes.json()) as FrankfurterResp) : null;

  const items: TickerItem[] = [
    { label: "USD/MXN", value: cg["usd-coin"].mxn, change: cg["usd-coin"].mxn_24h_change },
  ];

  if (fx?.rates?.MXN) {
    items.push({ label: "EUR/MXN", value: fx.rates.MXN, change: 0 });
  }

  items.push(
    { label: "BTC/USD", value: cg.bitcoin.usd, change: cg.bitcoin.usd_24h_change },
    { label: "ETH/USD", value: cg.ethereum.usd, change: cg.ethereum.usd_24h_change },
    { label: "BTC/MXN", value: cg.bitcoin.mxn, change: cg.bitcoin.mxn_24h_change },
    { label: "USDC/MXN", value: cg["usd-coin"].mxn, change: cg["usd-coin"].mxn_24h_change },
  );

  return items;
}

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL_MS) {
    return NextResponse.json({ items: cache.items, cached: true });
  }

  try {
    const items = await fetchTicker();
    cache = { ts: Date.now(), items };
    return NextResponse.json({ items, cached: false });
  } catch (err) {
    logError("ticker fetch failed", err);
    if (cache) {
      return NextResponse.json({ items: cache.items, cached: true, stale: true });
    }
    return NextResponse.json({ items: [], error: "unavailable" }, { status: 503 });
  }
}
