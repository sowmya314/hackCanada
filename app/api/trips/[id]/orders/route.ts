import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  notes: z.string().max(400).optional(),
  lines: z
    .array(
      z.object({
        costcoItemId: z.string().min(1),
        claimedUnits: z.number().int().positive(),
      })
    )
    .min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tripId } = await params;

  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip || trip.status !== "OPEN") {
      return NextResponse.json({ error: "Trip unavailable." }, { status: 400 });
    }

    const ids = parsed.lines.map((line) => line.costcoItemId);
    const items = await prisma.costcoItem.findMany({ where: { id: { in: ids } } });
    const itemMap = new Map(items.map((item) => [item.id, item]));

    for (const line of parsed.lines) {
      const item = itemMap.get(line.costcoItemId);
      if (!item) {
        return NextResponse.json({ error: `Item missing: ${line.costcoItemId}` }, { status: 400 });
      }
      if (line.claimedUnits > item.packCount) {
        return NextResponse.json(
          {
            error: `${item.itemName} only has ${item.packCount} ${item.unitType} in a pack.`,
          },
          { status: 400 }
        );
      }
    }

    const order = await prisma.order.create({
      data: {
        tripId,
        userId: user.id,
        notes: parsed.notes,
        items: {
          create: parsed.lines.map((line) => ({
            costcoItemId: line.costcoItemId,
            claimedUnits: line.claimedUnits,
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json({ ok: true, order });
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}
