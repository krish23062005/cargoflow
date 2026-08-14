import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOrgLive, subscribeTracking } from "@/server/tracking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Long-lived stream: Vercel Pro allows up to 300s; anything above needs the
// Pro "fluid compute" tier. Keep SSE brief and rely on auto-reconnect.
export const maxDuration = 300;

const HEARTBEAT_MS = 30_000;

/**
 * Server-Sent Events stream of live vehicle positions for the active
 * organization. Emits:
 *   - `positions` — a full latest snapshot of the org's fleet (every change)
 *   - `heartbeat` — a keep-alive comment every 30s
 * Clients should auto-reconnect (EventSource does by default).
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) {
    return new Response("No active organization", { status: 400 });
  }

  const member = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: session.user.id,
      },
    },
    select: { id: true },
  });
  if (!member) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let onClose: (() => void) | undefined;
  const stream = new ReadableStream({
    start(controller) {
      let aborted = false;
      const send = (payload: string) => {
        if (aborted || controller.desiredSize === null) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Client gone.
        }
      };

      // Initial burst.
      void getOrgLive(prisma, organizationId)
        .then((vehicles) => {
          send(`event: positions\ndata: ${JSON.stringify({ vehicles })}\n\n`);
        })
        .catch(() => {
          // Snapshot failure shouldn't kill the stream; updates will follow.
        });

      const unsubscribe = subscribeTracking(organizationId, (event, data) => {
        send(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      });

      const heartbeat = setInterval(() => {
        send(`: heartbeat ${Date.now()}\n\n`);
      }, HEARTBEAT_MS);

      controller.enqueue(
        encoder.encode(`retry: 3000\n\n`),
      );

      // Abort cleanup. Exposed via `stream.onClose` (set after construction)
      // so Next.js can also tear the stream down when the client disconnects.
      onClose = () => {
        aborted = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };
      request.signal.addEventListener("abort", onClose);
    },
  });

  if (onClose) {
    (stream as unknown as { onClose?: () => void }).onClose = onClose;
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}