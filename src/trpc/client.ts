import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/trpc/routers";

export const api = createTRPCReact<AppRouter>();
