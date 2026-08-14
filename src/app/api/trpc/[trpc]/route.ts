import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers";
import { checkWindowRateLimit } from "@/server/rate-limit";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 300;

/**
 * Coarse API-abuse guard in front of every tRPC call: 300 req/min per client
 * IP (DevTools throttle / a scripted scraper trips it; a normal dashboard user
 * won't). Auth/session checks inside the procedures stay authoritative - this
 * only sheds load from obviously abusive traffic. In-memory, single-process.
 */
function getClientKey(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${ip ?? "unknown"}`;
}

const handler = async (req: NextRequest) => {
  const limit = await checkWindowRateLimit(getClientKey(req), WINDOW_MS, MAX_PER_WINDOW);
  if (!limit.ok) {
    return new Response(JSON.stringify({ message: "Rate limit exceeded. Try again later." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(limit.retryAfterSec),
      },
    });
  }

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext(),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(`tRPC failed on ${path ?? "<no-path>"}:`, error);
          }
        : undefined,
  });
};

export { handler as GET, handler as POST };