import { verifyDriverLogin, setDriverSession } from "@/server/driver";

export const runtime = "nodejs";

const loginBodySchema = (body: unknown): { phone: string; pin: string } | null => {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.phone !== "string" || typeof b.pin !== "string") return null;
  return { phone: b.phone.trim(), pin: b.pin.trim() };
};

/**
 * Driver login (phone + PIN). Successful login sets an httpOnly driver
 * session cookie scoped to `/driver`.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = loginBodySchema(body);
  if (!parsed || !parsed.phone || !parsed.pin) {
    return Response.json({ error: "Phone and PIN are required" }, { status: 400 });
  }

  const identity = await verifyDriverLogin(parsed);
  if (!identity) {
    return Response.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  await setDriverSession(identity.organizationId, identity.driverId);
  return Response.json({ ok: true });
}