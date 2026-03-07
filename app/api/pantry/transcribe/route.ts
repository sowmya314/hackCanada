import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  audioBase64: z.string().min(20),
  mimeType: z.string().default("audio/m4a"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 400 });
    }

    const model = process.env.GEMINI_TRANSCRIBE_MODEL ?? "gemini-1.5-flash";

    const prompt =
      "Transcribe this grocery voice note. Return plain text only, no JSON, no markdown.";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: parsed.mimeType,
                    data: parsed.audioBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: errText.slice(0, 300) }, { status: 502 });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!text) {
      return NextResponse.json({ error: "No transcript returned by Gemini" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, text, provider: "gemini-transcribe" });
  } catch {
    return NextResponse.json({ error: "Invalid transcription request." }, { status: 400 });
  }
}
