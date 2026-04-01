import { z } from "zod";
import { createTRPCRouter } from "@/trpc/init";
import { prisma } from "@/lib/prisma";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "@/modules/auth/server/middleware";
import type { UserModel as User } from "@/generated/prisma/models";

async function requireClubAdmin(user: User, clubId: string) {
  const m = await prisma.membership.findUnique({
    where: { userId_clubId: { userId: user.id, clubId } },
    select: { role: true, status: true },
  });

  if (!m || m.status !== "ACCEPTED") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not an active member" });
  }

  if (m.role !== "PRESIDENT" && m.role !== "VICE_PRESIDENT") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only club admins can manage events" });
  }
  return m;
}

async function requireAcceptedMember(user: User, clubId: string) {
  const m = await prisma.membership.findUnique({
    where: { userId_clubId: { userId: user.id, clubId } },
    select: { status: true },
  });

  if (!m || m.status !== "ACCEPTED") {
    throw new TRPCError({ code: "FORBIDDEN", message: "You must be an accepted member to RSVP" });
  }
  return m;
}

const EventInput = z.object({
  clubId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000).optional().nullable(),
  location: z.string().min(1).max(500).optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional().nullable(),
  color: z.string().regex(/^#([A-Fa-f0-9]{6})$/).optional().nullable(),
  isRecurring: z.boolean().optional().default(false),
  capacity: z.number().int().min(0).optional().nullable(),
  waitlistEnabled: z.boolean().optional().default(true),
});

const EventItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  color: z.string().nullable(),
  capacity: z.number().int().nullable(),
  waitlistEnabled: z.boolean(),

  registeredCount: z.number().int(),
  checkedInCount: z.number().int(),
  waitlistCount: z.number().int(),

  viewerStatus: z.enum(["REGISTERED", "WAITLIST", "CHECKED_IN"]).nullable(),
  timeState: z.enum(["UPCOMING", "SOLD_OUT", "ENDED"]),
});

export const eventsRouter = createTRPCRouter({
  // Public-facing event lists for a club
  getClubEvents: protectedProcedure
    .input(
      z.object({
        clubId: z.string(),
        upcomingLimit: z.number().min(1).max(100).default(6),
        pastLimit: z.number().min(1).max(100).default(6),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const { clubId, upcomingLimit, pastLimit } = input;
      const userId = ctx.user.id;

      const [upcoming, past] = await Promise.all([
        prisma.event.findMany({
          where: { clubId, startsAt: { gte: now } },
          orderBy: { startsAt: "asc" },
          take: upcomingLimit,
          select: {
            id: true,
            title: true,
            description: true,
            location: true,
            startsAt: true,
            endsAt: true,
            color: true,
            capacity: true,
            waitlistEnabled: true,
          },
        }),
        prisma.event.findMany({
          where: { clubId, startsAt: { lt: now } },
          orderBy: { startsAt: "desc" },
          take: pastLimit,
          select: {
            id: true,
            title: true,
            description: true,
            location: true,
            startsAt: true,
            endsAt: true,
            color: true,
            capacity: true,
            waitlistEnabled: true,
          },
        }),
      ]);

      const enrich = async (events: typeof upcoming) => {
        return Promise.all(
          events.map(async (e) => {
            const [viewerReg, registeredCount, checkedInCount, waitlistCount] = await Promise.all([
              prisma.eventRegistration.findUnique({
                where: { userId_eventId: { userId, eventId: e.id } },
                select: { status: true },
              }),
              prisma.eventRegistration.count({
                where: { eventId: e.id, status: { in: ["REGISTERED", "CHECKED_IN"] } },
              }),
              prisma.eventRegistration.count({
                where: { eventId: e.id, status: "CHECKED_IN" },
              }),
              prisma.eventRegistration.count({
                where: { eventId: e.id, status: "WAITLIST" },
              }),
            ]);

            const viewerStatus = viewerReg?.status ?? null;
            const capacity = e.capacity ?? null;
            const registeredIsAtCapacity = capacity !== null && registeredCount >= capacity;

            const timeState: "UPCOMING" | "SOLD_OUT" | "ENDED" =
              e.startsAt >= now
                ? registeredIsAtCapacity
                  ? "SOLD_OUT"
                  : "UPCOMING"
                : "ENDED";

            const enriched = {
              id: e.id,
              title: e.title,
              description: e.description ?? null,
              location: e.location ?? null,
              startsAt: e.startsAt.toISOString(),
              endsAt: e.endsAt?.toISOString() ?? null,
              capacity: capacity,
              color: e.color ?? "#2563EB",
              waitlistEnabled: e.waitlistEnabled,
              registeredCount,
              checkedInCount,
              waitlistCount,
              viewerStatus,
              timeState,
            };

            // Runtime validation (helps ensure future schema changes don't break UI silently)
            return EventItemSchema.parse(enriched);
          })
        );
      };

      return {
        upcoming: await enrich(upcoming),
        past: await enrich(past),
      };
    }),

  // User RSVP to an event (register or waitlist)
  rsvpToEvent: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const existing = await prisma.eventRegistration.findUnique({
        where: { userId_eventId: { userId, eventId: input.eventId } },
        select: { status: true },
      });
      if (existing) return { status: existing.status as "REGISTERED" | "WAITLIST" | "CHECKED_IN" };

      const event = await prisma.event.findUnique({
        where: { id: input.eventId },
        select: { id: true, clubId: true, capacity: true, waitlistEnabled: true },
      });

      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      await requireAcceptedMember(ctx.user, event.clubId);

      const registeredCount = await prisma.eventRegistration.count({
        where: { eventId: event.id, status: { in: ["REGISTERED", "CHECKED_IN"] } },
      });

      const capacity = event.capacity ?? null;
      const isAtCapacity = capacity !== null && registeredCount >= capacity;

      const status = isAtCapacity
        ? event.waitlistEnabled
          ? "WAITLIST"
          : null
        : "REGISTERED";

      if (!status) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This event is sold out" });
      }

      await prisma.eventRegistration.create({
        data: {
          eventId: event.id,
          userId,
          status,
        },
      });

      return { status };
    }),

  cancelRsvp: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const registration = await prisma.eventRegistration.findUnique({
        where: { userId_eventId: { userId: ctx.user.id, eventId: input.eventId } },
        include: {
          event: {
            select: { clubId: true },
          },
        },
      });

      if (!registration) {
        return { ok: true };
      }

      await requireAcceptedMember(ctx.user, registration.event.clubId);

      await prisma.eventRegistration.delete({
        where: { userId_eventId: { userId: ctx.user.id, eventId: input.eventId } },
      });

      return { ok: true };
    }),

  // Admin-only event check-in
  checkIn: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const event = await prisma.event.findUnique({
        where: { id: input.eventId },
        select: { clubId: true },
      });

      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });

      await requireClubAdmin(ctx.user, event.clubId);

      const reg = await prisma.eventRegistration.findUnique({
        where: { userId_eventId: { userId: input.userId, eventId: input.eventId } },
        select: { status: true, id: true },
      });

      if (!reg) throw new TRPCError({ code: "NOT_FOUND", message: "Registration not found" });
      if (reg.status !== "REGISTERED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only registered users can be checked in" });
      }

      await prisma.eventRegistration.update({
        where: { userId_eventId: { userId: input.userId, eventId: input.eventId } },
        data: { status: "CHECKED_IN", checkedInAt: new Date() },
      });

      return { ok: true };
    }),

  // Admin: create event
  createEvent: protectedProcedure
    .input(
      EventInput.extend({
        clubId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireClubAdmin(ctx.user, input.clubId);

      const event = await prisma.event.create({
        data: {
          clubId: input.clubId,
          title: input.title,
          description: input.description ?? null,
          location: input.location ?? null,
          startsAt: input.startsAt,
          endsAt: input.endsAt ?? null,
          color: input.color ?? null,
          isRecurring: input.isRecurring,
          capacity: input.capacity ?? null,
          waitlistEnabled: input.waitlistEnabled,
        },
      });

      return { id: event.id };
    }),

  // Admin: update event
  updateEvent: protectedProcedure
    .input(
      EventInput.extend({
        eventId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.event.findUnique({
        where: { id: input.eventId },
        select: { clubId: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });

      await requireClubAdmin(ctx.user, existing.clubId);

      const event = await prisma.event.update({
        where: { id: input.eventId },
        data: {
          title: input.title,
          description: input.description ?? null,
          location: input.location ?? null,
          startsAt: input.startsAt,
          endsAt: input.endsAt ?? null,
          color: input.color ?? null,
          isRecurring: input.isRecurring,
          capacity: input.capacity ?? null,
          waitlistEnabled: input.waitlistEnabled,
        },
      });

      return { id: event.id };
    }),

  // Admin: delete event
  deleteEvent: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const event = await prisma.event.findUnique({
        where: { id: input.eventId },
        select: { clubId: true },
      });
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      await requireClubAdmin(ctx.user, event.clubId);

      await prisma.event.delete({ where: { id: input.eventId } });
      return { ok: true };
    }),

  // Admin: attendance list for a specific event
  getEventAttendance: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const event = await prisma.event.findUnique({
        where: { id: input.eventId },
        select: { clubId: true },
      });
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });

      await requireClubAdmin(ctx.user, event.clubId);

      const regs = await prisma.eventRegistration.findMany({
        where: { eventId: input.eventId },
        orderBy: [
          { status: "desc" },
          { createdAt: "desc" },
        ],
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      return regs.map((r) => ({
        id: r.id,
        userId: r.userId,
        status: r.status,
        checkedInAt: r.checkedInAt?.toISOString() ?? null,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        email: r.user.email,
        avatarUrl: r.user.avatarUrl,
      }));
    }),
});
