export type PantrySuggestion = {
  title: string;
  missingIngredients: string[];
};

export type PantryOutput = {
  pantryItems: string[];
  suggestedRecipes: PantrySuggestion[];
  provider: "api" | "fallback";
  warning?: string;
};

function fallbackPantry(text: string): PantryOutput {
  const pantryItems = text
    .toLowerCase()
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const recipes = [
    { title: "Quick Protein Bowl", needs: ["rice", "chicken", "avocado", "onion"] },
    { title: "Campus Pasta", needs: ["pasta", "tomato sauce", "garlic", "cheese"] },
    { title: "Fresh Toast Combo", needs: ["bread", "avocado", "eggs", "milk"] }
  ];

  return {
    pantryItems,
    suggestedRecipes: recipes.map((r) => ({
      title: r.title,
      missingIngredients: r.needs.filter((n) => !pantryItems.some((p) => p.includes(n)))
    })),
    provider: "fallback",
    warning: "Using local recipe fallback. Configure API base URL to use Gemini-backed endpoint."
  };
}

export async function generatePantrySuggestions(
  transcript: string,
  apiBaseUrl?: string
): Promise<PantryOutput> {
  if (!apiBaseUrl) return fallbackPantry(transcript);

  try {
    const res = await fetch(`${apiBaseUrl}/api/pantry/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript })
    });

    if (!res.ok) return fallbackPantry(transcript);
    const data = await res.json();

    if (!data?.analysis?.suggestedRecipes) return fallbackPantry(transcript);

    return {
      pantryItems: data.analysis.pantryItems,
      suggestedRecipes: data.analysis.suggestedRecipes,
      provider: "api",
      warning: data.warning
    };
  } catch {
    return fallbackPantry(transcript);
  }
}
