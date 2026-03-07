"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SessionUser = {
  id: string;
  name: string;
  email: string;
  activeCommunityId: string | null;
  homeLat?: number | null;
  homeLng?: number | null;
};

type CostcoItem = {
  id: string;
  category: string;
  itemName: string;
  packCount: number;
  unitType: string;
  rawLabel: string;
};

type Trip = {
  id: string;
  dayOfWeek: string;
  pickupLocation: string;
  status: "OPEN" | "COMPLETED";
  runner: {
    name: string;
    completedTripsCount: number;
  };
  ordersAttached: number;
};

type PantryResult = {
  pantryItems: string[];
  suggestedRecipes: { title: string; missingIngredients: string[] }[];
};

type ShoppingGoal = {
  id: string;
  label: string;
  icon: string;
  categories: string[];
};

const goals: ShoppingGoal[] = [
  { id: "weekly", label: "Weekly Restock", icon: "🛒", categories: ["Produce", "Pantry", "Dairy"] },
  { id: "meal-prep", label: "Meal Prep", icon: "🥗", categories: ["Protein", "Produce", "Pantry"] },
  { id: "cleaning", label: "Cleaning", icon: "🧼", categories: ["Cleaners", "Household"] },
  { id: "party", label: "Party Night", icon: "🎉", categories: ["Snacks", "Drinks", "Bakery"] },
  { id: "campus", label: "Campus Essentials", icon: "🎒", categories: ["Frozen", "Snacks", "Drinks"] },
];

function itemImage(item: CostcoItem) {
  const n = item.itemName.toLowerCase();
  const c = item.category.toLowerCase();
  if (n.includes("beet")) return "/images/items/beet.svg";
  if (n.includes("avocado")) return "/images/items/avocado.svg";
  if (n.includes("carrot")) return "/images/items/carrot.svg";
  if (n.includes("milk") || c.includes("dairy")) return "/images/items/milk.svg";
  if (n.includes("bread") || c.includes("bakery")) return "/images/items/bread.svg";
  if (c.includes("drink") || n.includes("water")) return "/images/items/drink.svg";
  if (c.includes("clean")) return "/images/items/cleaner.svg";
  if (c.includes("snack")) return "/images/items/snack.svg";
  if (c.includes("meat") || c.includes("protein")) return "/images/items/meat.svg";
  return "/images/items/grocery.svg";
}

function simulatedPrice(item: CostcoItem) {
  const base = 8.49 + item.packCount * 0.83;
  return base.toFixed(2);
}

export function DashboardClient({ initialUser }: { initialUser: SessionUser }) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [items, setItems] = useState<CostcoItem[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [search, setSearch] = useState("");
  const [activeGoal, setActiveGoal] = useState(goals[0].id);
  const [activeCategory, setActiveCategory] = useState("All");
  const [locationLabel, setLocationLabel] = useState("Finding your location...");
  const [transcript, setTranscript] = useState("");
  const [pantry, setPantry] = useState<PantryResult | null>(null);
  const [pantryProvider, setPantryProvider] = useState<"gemini" | "fallback" | null>(null);
  const [pantryWarning, setPantryWarning] = useState("");

  async function loadMe() {
    const res = await fetch("/api/me");
    if (!res.ok) return;
    const data = await res.json();
    setUser(data.user);
  }

  async function loadItems(q = "") {
    const res = await fetch(`/api/items?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setItems(data.items ?? []);
  }

  async function loadTrips() {
    const res = await fetch("/api/trips");
    const data = await res.json();
    setTrips(data.trips ?? []);
  }

  async function syncLocation() {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationLabel("Location unavailable");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLocationLabel(`${lat.toFixed(3)}, ${lng.toFixed(3)}`);

        await fetch("/api/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ homeLat: lat, homeLng: lng }),
        });
        await loadMe();
      },
      () => setLocationLabel("Location blocked"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  useEffect(() => {
    void loadMe();
    void loadItems();
    void loadTrips();
    void syncLocation();
  }, []);

  const categoryOptions = useMemo(() => {
    const unique = Array.from(new Set(items.map((i) => i.category))).slice(0, 8);
    return ["All", ...unique];
  }, [items]);

  const filteredItems = useMemo(() => {
    const goal = goals.find((g) => g.id === activeGoal);
    return items
      .filter((item) => {
        const goalMatch = goal
          ? goal.categories.some((cat) => item.category.toLowerCase().includes(cat.toLowerCase()))
          : true;
        const categoryMatch =
          activeCategory === "All" || item.category.toLowerCase() === activeCategory.toLowerCase();
        const searchMatch =
          !search ||
          item.itemName.toLowerCase().includes(search.toLowerCase()) ||
          item.category.toLowerCase().includes(search.toLowerCase());
        return goalMatch && categoryMatch && searchMatch;
      })
      .slice(0, 12);
  }, [items, activeGoal, activeCategory, search]);

  async function analyzePantry() {
    const res = await fetch("/api/pantry/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    const data = await res.json();
    setPantry(data.analysis ?? null);
    setPantryProvider(data.provider ?? null);
    setPantryWarning(data.warning ?? "");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mobile-shell">
      <section className="mobile-hero">
        <div className="top-search-row">
          <input
            className="mobile-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              void loadItems(e.target.value);
            }}
            placeholder='Search for "Grocery"'
          />
          <button type="button" className="icon-btn" onClick={logout} aria-label="Logout">
            ⎋
          </button>
        </div>
        <p className="location-label">Current Location</p>
        <h2 className="location-value">{locationLabel}</h2>

        <div className="goal-row">
          {goals.map((goal) => (
            <button
              key={goal.id}
              type="button"
              className={`goal-chip ${activeGoal === goal.id ? "active" : ""}`}
              onClick={() => setActiveGoal(goal.id)}
            >
              <span>{goal.icon}</span>
              {goal.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mobile-section">
        <div className="section-head">
          <h3>You might need</h3>
          <button type="button" className="link-btn">See more</button>
        </div>

        <div className="bubble-row">
          {categoryOptions.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`category-bubble ${activeCategory === cat ? "active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="product-grid">
          {filteredItems.map((item) => (
            <article className="product-card" key={item.id}>
              <img src={itemImage(item)} alt={item.itemName} className="product-image" />
              <h4>{item.itemName}</h4>
              <p className="muted-mini">{item.packCount} {item.unitType}</p>
              <p className="price">${simulatedPrice(item)}</p>
              <button type="button" className="add-btn">+</button>
            </article>
          ))}
        </div>
      </section>

      <section className="mobile-section quick-actions">
        <h3>What do you need to do?</h3>
        <div className="action-grid">
          <button type="button" className="action-card">Create Costco Trip</button>
          <button type="button" className="action-card">Attach to Neighbor Trip</button>
          <button type="button" className="action-card">Split Multipack Items</button>
          <button type="button" className="action-card">Check Runner Ratings</button>
        </div>
      </section>

      <section className="mobile-section">
        <div className="section-head">
          <h3>Community Trips</h3>
          <span className="muted-mini">{trips.length} trips</span>
        </div>
        <div className="trip-strip">
          {trips.slice(0, 4).map((trip) => (
            <div key={trip.id} className="trip-card">
              <strong>{trip.dayOfWeek}</strong>
              <p>{trip.pickupLocation}</p>
              <p className="muted-mini">{trip.runner.name} · {trip.ordersAttached} orders</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mobile-section pantry-block">
        <h3>Pantry AI Assistant</h3>
        <p className="muted-mini">Speak inventory and get recipes using Gemini.</p>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="eggs, spinach, bread, milk"
          rows={3}
        />
        <button type="button" onClick={analyzePantry}>Generate Recipes</button>
        {pantryProvider ? <p className="muted-mini">AI mode: {pantryProvider}</p> : null}
        {pantryWarning ? <p className="warn-mini">{pantryWarning}</p> : null}
        {pantry ? (
          <div className="recipe-list">
            {pantry.suggestedRecipes.map((recipe) => (
              <div className="recipe-card" key={recipe.title}>
                <strong>{recipe.title}</strong>
                <p className="muted-mini">Missing: {recipe.missingIngredients.join(", ") || "Nothing"}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <nav className="mobile-nav">
        <button type="button">🏠</button>
        <button type="button">📋</button>
        <button type="button">♡</button>
        <button type="button">🚚</button>
      </nav>
    </main>
  );
}
