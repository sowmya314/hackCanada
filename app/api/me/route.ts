import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  const [creditAgg, communities] = await Promise.all([
    prisma.storeCreditLedger.aggregate({
      where: { userId: user.id },
      _sum: { amount: true },
    }),
    prisma.communityMember.findMany({
      where: { userId: user.id },
      include: { community: true },
    }),
  ]);

  return NextResponse.json({
    user,
    storeCreditBalance: creditAgg._sum.amount ?? 0,
    communities: communities.map((m) => m.community),
  });
}

const locationSchema = z.object({
  homeLat: z.number().min(-90).max(90),
  homeLng: z.number().min(-180).max(180),
});

export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = locationSchema.parse(body);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        homeLat: parsed.homeLat,
        homeLng: parsed.homeLng,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}
