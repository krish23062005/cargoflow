import { TRPCError } from "@trpc/server";
import type { Prisma as PrismaTypes, PrismaClient } from "@/generated/prisma/client";
import { createTRPCRouter, requirePermission, auditedProcedure } from "@/trpc/init";
import {
  createDriverSchema,
  updateDriverSchema,
  archiveDriverSchema,
  listDriversSchema,
  driverIdSchema,
} from "@/lib/validators/driver";
import { notifyByPermission } from "@/server/notification";
import { hashPin, generatePin } from "@/lib/pin";
import { sendDriverPinEmail } from "@/server/email";

const EXPIRING_SOON_DAYS = 30;

/** Strip the hashed PIN from any driver returned to the UI. */
function publicDriver<T extends { pin?: string | null }>(driver: T) {
  const { pin, ...rest } = driver;
  void pin;
  return rest;
}

function licenseStatus(expiry: Date): "VALID" | "EXPIRING" | "EXPIRED" {
  const now = Date.now();
  const t = expiry.getTime();
  if (t < now) return "EXPIRED";
  if (t <= now + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000) return "EXPIRING";
  return "VALID";
}

function licenseAlertLabel(expiry: Date): { title: string; body: string } | null {
  const status = licenseStatus(expiry);
  if (status === "VALID") return null;
  const date = expiry.toLocaleDateString();
  if (status === "EXPIRED") {
    return {
      title: "Driver licence expired",
      body: `A driver's licence expired on ${date} — renewal required before they can be assigned.`,
    };
  }
  return {
    title: "Driver licence expiring soon",
    body: `A driver's licence expires on ${date} — renew within the next ${EXPIRING_SOON_DAYS} days.`,
  };
}

/**
 * Returns a friendly CONFLICT if another driver in the org already uses the
 * phone or licence number. `excludeId` is passed when updating.
 */
async function assertUniqueFields(
  prisma: PrismaClient,
  organizationId: string,
  data: { phone?: string; licenseNumber?: string },
  excludeId?: string,
) {
  if (data.phone) {
    const dup = await prisma.driver.findFirst({
      where: {
        organizationId,
        phone: data.phone,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (dup) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A driver with this phone number already exists",
      });
    }
  }
  if (data.licenseNumber) {
    const dup = await prisma.driver.findFirst({
      where: {
        organizationId,
        licenseNumber: data.licenseNumber,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (dup) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A driver with this licence number already exists",
      });
    }
  }
}

/**
 * Driver management. Viewing is available to owner, admin and dispatcher
 * (`driver.view`); writes require `driver.manage`. All writes are audited.
 * Drivers are sensitive records (phone, license, next of kin), so viewers
 * are intentionally excluded.
 */
export const driverRouter = createTRPCRouter({
  /**
   * Paginated driver list with search + status/license filters.
   */
  list: requirePermission("driver.view")
    .input(listDriversSchema)
    .query(async ({ ctx, input }) => {
      const page = Math.max(1, input.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
      const skip = (page - 1) * pageSize;

      const now = Date.now();
      const expiresSoon = new Date(now + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);

      const licenseWhere: PrismaTypes.DriverWhereInput | undefined =
        input.licenseStatus === "EXPIRED"
          ? { licenseExpiry: { lt: new Date(now) } }
          : input.licenseStatus === "EXPIRING"
            ? { licenseExpiry: { gte: new Date(now), lte: expiresSoon } }
            : input.licenseStatus === "VALID"
              ? { licenseExpiry: { gt: expiresSoon } }
              : undefined;

      const where: PrismaTypes.DriverWhereInput = {
        organizationId: ctx.organizationId,
        ...(input.search
          ? {
              OR: [
                { name: { contains: input.search, mode: "insensitive" } },
                { phone: { contains: input.search, mode: "insensitive" } },
                { email: { contains: input.search, mode: "insensitive" } },
                { licenseNumber: { contains: input.search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(licenseWhere ?? {}),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.driver.findMany({
          where,
          orderBy: [{ name: "asc" }],
          skip,
          take: pageSize,
        }),
        ctx.prisma.driver.count({ where }),
      ]);

      return {
        items: items.map((driver) => ({
          ...publicDriver(driver),
          licenseStatus: licenseStatus(driver.licenseExpiry),
        })),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }),

  /**
   * Driver summary counts for dashboards and KPIs, including license alerts.
   */
  summary: requirePermission("driver.view").query(async ({ ctx }) => {
    const now = Date.now();
    const expiresSoon = new Date(now + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);

    const [byStatus, licenseExpiring, licenseExpired] = await Promise.all([
      ctx.prisma.driver.groupBy({
        by: ["status"],
        where: { organizationId: ctx.organizationId },
        _count: { _all: true },
      }),
      ctx.prisma.driver.count({
        where: {
          organizationId: ctx.organizationId,
          licenseExpiry: { gte: new Date(now), lte: expiresSoon },
        },
      }),
      ctx.prisma.driver.count({
        where: {
          organizationId: ctx.organizationId,
          licenseExpiry: { lt: new Date(now) },
        },
      }),
    ]);

    const statusCounts = Object.fromEntries(
      byStatus.map((g) => [g.status, g._count._all]),
    );

    return {
      total: byStatus.reduce((sum, g) => sum + g._count._all, 0),
      available: statusCounts["AVAILABLE"] ?? 0,
      onTrip: statusCounts["ON_TRIP"] ?? 0,
      offDuty: statusCounts["OFF_DUTY"] ?? 0,
      suspended: statusCounts["SUSPENDED"] ?? 0,
      licenseExpiring,
      licenseExpired,
    };
  }),

  /**
   * Single driver by id (org-scoped).
   */
  get: requirePermission("driver.view")
    .input(driverIdSchema)
    .query(async ({ ctx, input }) => {
      const driver = await ctx.prisma.driver.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      });
      if (!driver) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Driver not found" });
      }
      return {
        ...publicDriver(driver),
        licenseStatus: licenseStatus(driver.licenseExpiry),
      };
    }),

  /**
   * Create a driver. Audited.
   */
  create: auditedProcedure({
    permission: "driver.manage",
    resource: "driver",
    action: "CREATE",
    resourceId: (_input, result) =>
      (result as { id?: string } | null | undefined)?.id ?? null,
    metadata: (input) => {
      const d = input as { name?: string; phone?: string; licenseNumber?: string };
      return { name: d.name ?? "", phone: d.phone ?? "", licenseNumber: d.licenseNumber ?? "" };
    },
  })
.input(createDriverSchema)
      .mutation(async ({ ctx, input }) => {
        await assertUniqueFields(ctx.prisma, ctx.organizationId, input);

        // If the admin didn't supply a PIN, generate one so the driver can log
        // in. We always resolve to a concrete PIN here (never null), store only
        // its hash, and return the plaintext once so the UI can show it.
        const { pin, ...rest } = input;
        const resolvedPin = pin ?? generatePin();
        const driver = await ctx.prisma.driver.create({
          data: {
            organizationId: ctx.organizationId,
            ...rest,
            pin: hashPin(resolvedPin),
          },
        });

        // Deliver the PIN. Email uses the configured SMTP/Resend channel.
        // SMS has no provider wired up yet, so it logs a placeholder.
        const delivery =
          rest.email && driver.email
            ? await sendDriverPinEmail({
                to: driver.email,
                driverName: driver.name,
                orgName: ctx.organization.name,
                phone: driver.phone,
                pin: resolvedPin,
              })
            : null;
        if (driver.phone) {
          console.log(
            `[driver:sms] PIN for ${driver.name} (${driver.phone}) is ${resolvedPin} — SMS not configured`,
          );
        }

        const alert = licenseAlertLabel(driver.licenseExpiry);
        if (alert) {
          void notifyByPermission(ctx.prisma, {
            organizationId: ctx.organizationId,
            permission: "driver.view",
            type: "DRIVER_ALERT",
            title: alert.title,
            body: `${alert.body} A� ${driver.name} (${driver.phone})`,
            link: `/drivers/${driver.id}`,
          });
        }
        return {
          driver: publicDriver(driver),
          // Plaintext PIN shown exactly once to the admin right after creation.
          pin: resolvedPin,
          delivered: delivery,
        };
      }),

  /**
   * Update a driver. Audited.
   */
  update: auditedProcedure({
    permission: "driver.manage",
    resource: "driver",
    action: "UPDATE",
    resourceId: (input) => (input as { id?: string })?.id ?? null,
  })
    .input(updateDriverSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, pin, ...data } = input;
      const existing = await ctx.prisma.driver.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Driver not found" });
      }
      await assertUniqueFields(ctx.prisma, ctx.organizationId, data, id);
      const driver = await ctx.prisma.driver.update({
        where: { id },
        data: {
          ...data,
          ...(pin ? { pin: hashPin(pin) } : {}),
        },
      });
      const alert = licenseAlertLabel(driver.licenseExpiry);
      if (alert) {
        void notifyByPermission(ctx.prisma, {
          organizationId: ctx.organizationId,
          permission: "driver.view",
          type: "DRIVER_ALERT",
          title: alert.title,
          body: `${alert.body} · ${driver.name} (${driver.phone})`,
          link: `/drivers/${driver.id}`,
        });
      }
      return publicDriver(driver);
    }),

  /**
   * Reset a driver's login PIN: generates a fresh one, stores its hash, and
   * returns it in plaintext exactly once (and emails it when the driver has an
   * address). Audited.
   */
  resetPin: auditedProcedure({
    permission: "driver.manage",
    resource: "driver",
    action: "UPDATE",
    resourceId: (input) => (input as { id?: string })?.id ?? null,
  })
    .input(archiveDriverSchema)
    .mutation(async ({ ctx, input }) => {
      const driver = await ctx.prisma.driver.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      });
      if (!driver) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Driver not found" });
      }

      const pin = generatePin();
      await ctx.prisma.driver.update({
        where: { id: driver.id },
        data: { pin: hashPin(pin) },
      });

      const delivery =
        driver.email && driver.email.length > 0
          ? await sendDriverPinEmail({
              to: driver.email,
              driverName: driver.name,
              orgName: ctx.organization.name,
              phone: driver.phone,
              pin,
            })
          : null;
      if (driver.phone) {
        console.log(
          `[driver:sms] Reset PIN for ${driver.name} (${driver.phone}) is ${pin} — SMS not configured`,
        );
      }

      return { driverId: driver.id, pin, delivered: delivery };
    }),

/**
     * Archive a driver (marks them suspended so they stop receiving assignments).
     * Audited.
     */
    archive: auditedProcedure({
    permission: "driver.manage",
    resource: "driver",
    action: "DELETE",
    resourceId: (input) => (input as { id?: string })?.id ?? null,
  })
    .input(archiveDriverSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.driver.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Driver not found" });
      }
      return ctx.prisma.driver.update({
        where: { id: input.id },
        data: { status: "SUSPENDED" },
      });
    }),
});
