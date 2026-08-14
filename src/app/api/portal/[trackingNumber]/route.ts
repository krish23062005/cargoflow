import { getPortalData } from "@/server/portal";
import { checkRateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Public portal API — no authentication. Serves the aggregated tracking view
 * for one shipment, rate-limited per (IP, tracking number) to deter scraping.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ trackingNumber: string }> },
) {
  const { trackingNumber } = await params;

  const { ok, retryAfterSec } = await checkRateLimit(clientIp(req), trackingNumber);
  if (!ok) {
    return Response.json({ error: "RATE_LIMITED" }, {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    });
  }

  const data = await getPortalData(trackingNumber);
  if (!data) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return Response.json(data);
}