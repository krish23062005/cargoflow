import { clearDriverSession } from "@/server/driver";

export const runtime = "nodejs";

export async function POST() {
  await clearDriverSession();
  return Response.json({ ok: true });
}