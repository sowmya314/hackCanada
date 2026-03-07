import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  dayOfWeek: z.string().min(3),
  pickupLocation: z.string().min(5),
  pickupDate: z.string().datetime().optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user?.activeCommunityId) {
    return NextResponse.json({ trips: [] });
  }

  const trips = await prisma.trip.findMany({
    where: { communityId: user.activeCommunityId },
    include: {
      runner: true,
      _count: { select: { orders: true } },
      ratings: { select: { score: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const runnerIds = Array.from(new Set(trips.map((t) => t.runnerId)));
  const completedCounts = await prisma.trip.groupBy({
    by: ["runnerId"],
    where: { runnerId: { in: runnerIds }, status: "COMPLETED" },
    _count: { _all: true },
  });

  const completedMap = new Map(completedCounts.map((r) => [r.runnerId, r._count._all]));

  return NextResponse.json({
    trips: trips.map((trip) => {
      const avgRating =
        trip.ratings.length > 0
          ? trip.ratings.reduce((acc, cur) => acc + cur.score, 0) / trip.ratings.length
          : null;

      return {
        id: trip.id,
        dayOfWeek: trip.dayOfWeek,
        pickupLocation: trip.pickupLocation,
        pickupDate: trip.pickupDate,
        status: trip.status,
        createdAt: trip.createdAt,
        runner: {
          id: trip.runner.id,
          name: trip.runner.name,
          completedTripsCount: completedMap.get(trip.runnerId) ?? 0,
          rating: avgRating,
        },
        ordersAttached: trip._count.orders,
      };
    }),
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user?.activeCommunityId) {
    return NextResponse.json(
      { error: "Join a community before creating trips." },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    const trip = await prisma.trip.create({
      data: {
        communityId: user.activeCommunityId,
        runnerId: user.id,
        dayOfWeek: parsed.dayOfWeek,
        pickupLocation: parsed.pickupLocation,
        pickupDate: parsed.pickupDate ? new Date(parsed.pickupDate) : null,
      },
    });

    return NextResponse.json({ ok: true, trip });
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}
