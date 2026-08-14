import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Health check for uptime monitors (Vercel Cron, uptime bots, etc.).
 * Pings Postgres and reports overall status without exposing internals.
 * No auth on purpose - this is a public liveness/readiness probe.
 */
export async function GET() {
  const startedAt = process.hrtime.bigint();
  let db = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "up";
  } catch {
    /* database unreachable */
  }
  const latencyMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);
  const ok = db === "up";

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      db,
      uptimeSec: Math.round(process.uptime()),
      latencyMs,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}