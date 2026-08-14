import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { prisma } from "@/lib/db";
import { ac, roles } from "@/lib/access";
import { sendInvitationEmail } from "@/server/email";

/**
 * Resource/action statements used by the organization plugin's access control
 * are defined in src/lib/access.ts (shared with the client plugin).
 */
export const auth = betterAuth({
  appName: "CargoFlow",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  /**
   * In-memory fixed-window rate limiting (single-process; fine for demo scale).
   * Brute-force protection on sign-in / sign-up paths, plus a global ceiling
   * per client IP while we have no distributed store (Upstash Redis is the
   * production upgrade path).
   */
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email-password": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  advanced: {
    database: {
      generateId: false,
    },
  },
  plugins: [
    organization({
      ac,
      roles,
      creatorRole: "owner",
      /**
       * Invitations now email the recipient through `sendInvitationEmail`
       * (Resend, or a dev-mode log + copyable link when no key is set).
       *
       * We keep `requireEmailVerificationOnInvitation: false` so acceptance
       * works without a separate email-verification flow; flip it on (and add
       * Better Auth's `emailVerification` plugin) when that's required.
       */
      requireEmailVerificationOnInvitation: false,
      sendInvitationEmail: async (data) => {
        await sendInvitationEmail({
          to: data.email,
          orgName: data.organization.name,
          inviterName: data.inviter.user?.name ?? "A CargoFlow teammate",
          role: data.role,
          invitationId: data.id,
        });
      },
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

export type { Member } from "better-auth/plugins";
