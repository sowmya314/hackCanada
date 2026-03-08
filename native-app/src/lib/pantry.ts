export type PantrySuggestion = {
  title: string;
  missingIngredients: string[];
  ingredientPlan: Array<{
    name: string;
    recommendedQty: string;
    orderQty: string;
  }>;
};

export type PantryOutput = {
  pantryItems: string[];
  suggestedRecipes: PantrySuggestion[];
};

function parsePantryItems(text: string): string[] {
  return Array.from(
    new Set(
      text
    .toLowerCase()
    .split(/[;,]/)
    .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function buildRecipesFromPantry(pantryItems: string[]): PantrySuggestion[] {
  const top = pantryItems.slice(0, 6);
  const first = top[0] ?? "pantry";
  const second = top[1] ?? "veggies";
  const third = top[2] ?? "protein";

  const recipes = [
    {
      title: `${first} & ${second} Stir-Fry`,
      needs: [first, second, "garlic", "soy sauce", "olive oil"],
    },
    {
      title: `${first} Pasta Bowl`,
      needs: [first, "pasta", "tomato sauce", "onion", "parmesan"],
    },
    {
      title: `${second} Omelet Plate`,
      needs: [second, "eggs", "milk", "cheese", "pepper"],
    },
    {
      title: `${first} ${third} Rice Bowl`,
      needs: [first, third, "rice", "salt", "olive oil"],
    },
    {
      title: `Loaded ${second} Toast`,
      needs: [second, "bread", "butter", "eggs", "avocado"],
    },
  ];

  return recipes.map((r) => {
    const ingredientPlan = r.needs.map((name, index) => {
      const hasItem = pantryItems.some((p) => p.includes(name) || name.includes(p));
      const unit = index % 2 === 0 ? "cups" : "tbsp";
      const recommendedQty = index % 3 === 0 ? `1 ${unit}` : `2 ${unit}`;
      return {
        name: titleCase(name),
        recommendedQty,
        orderQty: hasItem ? "0" : recommendedQty,
      };
    });

    return {
      title: titleCase(r.title),
      missingIngredients: ingredientPlan
        .filter((item) => item.orderQty !== "0")
        .map((item) => `${item.name} (${item.orderQty})`),
      ingredientPlan,
    };
  });
}

function fallbackPantry(text: string): PantryOutput {
  const pantryItems = parsePantryItems(text);
  return {
    pantryItems,
    suggestedRecipes: buildRecipesFromPantry(pantryItems),
  };
}

export async function generatePantrySuggestions(transcript: string): Promise<PantryOutput> {
  return fallbackPantry(transcript);
}
