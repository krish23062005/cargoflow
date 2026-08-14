import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";
import { ac, roles } from "@/lib/access";

/**
 * Mirrors the org `additionalFields` configured on the server so the client
 * types (and runtime validation) include our custom org fields.
 */
const baseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    organizationClient({
      ac,
      roles,
      schema: {
        organization: {
          additionalFields: {
            country: { type: "string", required: true },
            currency: { type: "string", required: true },
            timezone: { type: "string", required: true },
            industry: { type: "string", required: false },
          },
        },
      },
    }),
  ],
});

export type { Organization as OrganizationResponse } from "better-auth/plugins";
