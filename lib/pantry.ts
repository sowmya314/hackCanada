type PantryAnalysis = {
  pantryItems: string[];
  suggestedRecipes: { title: string; missingIngredients: string[] }[];
};

export type PantryResult = {
  analysis: PantryAnalysis;
  provider: "gemini" | "fallback";
  warning?: string;
};

function heuristicAnalyze(transcript: string): PantryAnalysis {
  const normalized = transcript
    .toLowerCase()
    .replace(/[^a-z0-9, ]/g, " ")
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const pantryItems = Array.from(new Set(normalized)).slice(0, 20);

  const recipeTemplates = [
    {
      title: "Pantry Stir Fry",
      needs: ["rice", "soy sauce", "garlic", "onion", "broccoli"],
    },
    {
      title: "Hearty Pasta Bowl",
      needs: ["pasta", "tomato sauce", "olive oil", "parmesan"],
    },
    {
      title: "Breakfast Omelet",
      needs: ["eggs", "milk", "cheese", "spinach"],
    },
  ];

  const suggestedRecipes = recipeTemplates.map((recipe) => ({
    title: recipe.title,
    missingIngredients: recipe.needs.filter(
      (item) => !pantryItems.some((p) => p.includes(item) || item.includes(p))
    ),
  }));

  return { pantryItems, suggestedRecipes };
}

export async function analyzePantryWithGemini(
  transcript: string
): Promise<PantryResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      analysis: heuristicAnalyze(transcript),
      provider: "fallback",
      warning: "GEMINI_API_KEY is missing. Using local fallback suggestions.",
    };
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

  const prompt = `
You are an assistant for a bulk grocery sharing app.
Extract pantry items and propose 3 simple recipes.
Return strict JSON with this shape:
{
  "pantryItems": ["item"],
  "suggestedRecipes": [
    { "title": "string", "missingIngredients": ["item"] }
  ]
}
Pantry transcript:
${transcript}
`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    return {
      analysis: heuristicAnalyze(transcript),
      provider: "fallback",
      warning: `Gemini request failed (${res.status}). ${errText.slice(0, 160)}`,
    };
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed?.pantryItems) || !Array.isArray(parsed?.suggestedRecipes)) {
      return {
        analysis: heuristicAnalyze(transcript),
        provider: "fallback",
        warning: "Gemini response format was invalid. Using fallback parser.",
      };
    }
    return {
      analysis: {
        pantryItems: parsed.pantryItems,
        suggestedRecipes: parsed.suggestedRecipes,
      },
      provider: "gemini",
    };
  } catch {
    return {
      analysis: heuristicAnalyze(transcript),
      provider: "fallback",
      warning: "Gemini JSON parsing failed. Using fallback suggestions.",
    };
  }
}
