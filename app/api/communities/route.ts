import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { haversineMiles } from "@/lib/geo";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(3),
  description: z.string().min(8),
  latitude: z.number(),
  longitude: z.number(),
});

const joinSchema = z.object({
  communityId: z.string().min(1),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat") ?? "43.6532");
  const lng = Number(searchParams.get("lng") ?? "-79.3832");
  const radius = Number(searchParams.get("radius") ?? "25");

  const communities = await prisma.community.findMany({
    include: {
      _count: { select: { members: true, trips: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = communities
    .map((c) => {
      const distanceMiles = haversineMiles(lat, lng, c.latitude, c.longitude);
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        latitude: c.latitude,
        longitude: c.longitude,
        memberCount: c._count.members,
        tripCount: c._count.trips,
        distanceMiles,
      };
    })
    .filter((c) => c.distanceMiles <= radius)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  return NextResponse.json({ communities: result });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);

    const community = await prisma.community.create({
      data: {
        ...parsed,
        members: {
          create: { userId: user.id },
        },
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { activeCommunityId: community.id },
    });

    return NextResponse.json({ ok: true, community });
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = joinSchema.parse(body);

    const community = await prisma.community.findUnique({ where: { id: parsed.communityId } });
    if (!community) {
      return NextResponse.json({ error: "Community not found." }, { status: 404 });
    }

    await prisma.communityMember.upsert({
      where: {
        userId_communityId: {
          userId: user.id,
          communityId: parsed.communityId,
        },
      },
      create: {
        userId: user.id,
        communityId: parsed.communityId,
      },
      update: {},
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { activeCommunityId: parsed.communityId },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}
