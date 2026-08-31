import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Same-origin image proxy. The browser can't read cross-origin images that
 * lack CORS headers (e.g. the Azure CDN demo photos) into a <canvas>, which
 * blocks client-side watermarking of existing photos. This route fetches the
 * image server-side (no CORS restriction) and streams it back from our own
 * origin so the canvas can read it.
 *
 * An allowlist of hosts prevents this from becoming an open proxy / SSRF.
 */
function allowedHosts(): Set<string> {
  const hosts = new Set<string>([
    "bithauss-images-fpdpe5auefacdweh.z03.azurefd.net",
  ]);
  try {
    const supa = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supa) hosts.add(new URL(supa).host);
  } catch {
    /* ignore */
  }
  return hosts;
}

// BH-10: the host allowlist keeps this from being an open proxy, but an
// unthrottled proxy still lets anyone use BitHauss' egress bandwidth to
// hammer our own CDN.
const RATE_LIMIT = { limit: 120, windowMs: 60_000 } as const;

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, "proxy-image", RATE_LIMIT);
  if (limited) return limited;

  const target = req.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (parsed.protocol !== "https:" || !allowedHosts().has(parsed.host)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    const upstream = await fetch(parsed.toString());
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream ${upstream.status}` },
        { status: 502 }
      );
    }
    const contentType =
      upstream.headers.get("content-type") ?? "application/octet-stream";
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
