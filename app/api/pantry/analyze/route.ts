import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzePantryWithGemini } from "@/lib/pantry";

const schema = z.object({
  transcript: z.string().min(3),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { transcript } = schema.parse(body);
    const result = await analyzePantryWithGemini(transcript);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}
