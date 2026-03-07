import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { _count: { select: { orders: true } } },
  });

  if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  if (trip.runnerId !== user.id) {
    return NextResponse.json({ error: "Only the runner can complete this trip." }, { status: 403 });
  }
  if (trip.status === "COMPLETED") {
    return NextResponse.json({ error: "Trip already completed." }, { status: 400 });
  }

  const baseCredit = 8;
  const perOrderCredit = 2;
  const totalCredit = baseCredit + trip._count.orders * perOrderCredit;

  await prisma.$transaction([
    prisma.trip.update({ where: { id: tripId }, data: { status: "COMPLETED" } }),
    prisma.storeCreditLedger.create({
      data: {
        userId: user.id,
        amount: totalCredit,
        reason: `Completed trip ${trip.dayOfWeek} (${trip._count.orders} attached orders)`,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, creditAwarded: totalCredit });
}
