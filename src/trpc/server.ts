import { createCallerFactory, createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers";

/**
 * Server-side tRPC caller for use inside React Server Components.
 *
 * ```ts
 * const caller = await api();
 * const active = await caller.organization.getActive();
 * ```
 */
export async function api() {
  const createCaller = createCallerFactory(appRouter);
  return createCaller(await createTRPCContext());
}
