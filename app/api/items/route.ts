import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  const items = await prisma.costcoItem.findMany({
    where: q
      ? {
          OR: [
            { itemName: { contains: q } },
            { category: { contains: q } },
          ],
        }
      : undefined,
    take: 30,
    orderBy: [{ category: "asc" }, { itemName: "asc" }],
  });

  return NextResponse.json({ items });
}
