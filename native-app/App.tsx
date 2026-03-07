import React, { useMemo, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Audio } from "expo-av";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import { communities, fakeUsers, groceryItems, seededTrips, type Trip } from "./src/data/mock";
import { generatePantrySuggestions } from "./src/lib/pantry";

type Tab = "shop" | "trips" | "pantry" | "profile";

type CartLine = { itemId: string; claimedUnits: number };

const currentUserId = "u1";
const API_BASE_URL =
  typeof process !== "undefined" ? process.env.EXPO_PUBLIC_API_BASE_URL : undefined;

function normalizeRecipeCount(
  recipes: Array<{ title: string; missingIngredients: string[] }>,
  pantryItems: string[]
) {
  const starters = [...recipes];
  const fallbackTitles = [
    "Quick Pantry Wrap",
    "Bulk Bowl Special",
    "Neighborhood Pasta Mix",
    "Campus Protein Plate",
    "One-Pan Veggie Dinner",
    "Simple Soup Combo",
    "Stir Fry in 20",
    "Breakfast for Dinner"
  ];

  let idx = 0;
  while (starters.length < 8 && idx < fallbackTitles.length) {
    starters.push({
      title: fallbackTitles[idx],
      missingIngredients: pantryItems.length
        ? ["olive oil", "garlic"].filter((item) => !pantryItems.some((p) => p.includes(item)))
        : ["olive oil", "garlic", "onion"]
    });
    idx += 1;
  }
  return starters;
}

function productEmoji(category: string, name: string) {
  const c = category.toLowerCase();
  const n = name.toLowerCase();
  if (n.includes("avocado")) return "🥑";
  if (n.includes("beet")) return "🧅";
  if (n.includes("carrot")) return "🥕";
  if (c.includes("drink") || n.includes("water")) return "🥤";
  if (c.includes("bakery")) return "🥐";
  if (c.includes("dairy") || n.includes("milk")) return "🥛";
  if (c.includes("clean")) return "🧴";
  if (c.includes("snack") || c.includes("sweet")) return "🍪";
  if (c.includes("meat")) return "🍖";
  if (c.includes("produce")) return "🥦";
  return "🛒";
}

export default function App() {
  const [tab, setTab] = useState<Tab>("shop");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [trips, setTrips] = useState<Trip[]>(seededTrips);
  const [joinedCommunityIds, setJoinedCommunityIds] = useState<string[]>(["c1"]);
  const [activeCommunityId, setActiveCommunityId] = useState("c1");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedTripId, setSelectedTripId] = useState(
    seededTrips.find((trip) => trip.communityId === "c1")?.id ?? ""
  );
  const [locationLabel, setLocationLabel] = useState("Waterloo, ON");
  const [newTripDate, setNewTripDate] = useState("2026-03-14");
  const [newTripTime, setNewTripTime] = useState("12:30");
  const [newTripPickup, setNewTripPickup] = useState("");
  const [transcript, setTranscript] = useState("");
  const [pantryResult, setPantryResult] = useState<Awaited<ReturnType<typeof generatePantrySuggestions>> | null>(null);
  const [showAllRecipes, setShowAllRecipes] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  const categoryOptions = useMemo(() => {
    const unique = Array.from(new Set(groceryItems.map((item) => item.category)));
    return ["All", ...unique.slice(0, 14)];
  }, []);

  const visibleItems = useMemo(() => {
    return groceryItems.filter((item) => {
      const catMatch = category === "All" || item.category === category;
      const searchMatch = !search || item.name.toLowerCase().includes(search.toLowerCase());
      return catMatch && searchMatch;
    }).slice(0, 80);
  }, [category, search]);

  const tripsForActiveCommunity = useMemo(
    () => trips.filter((trip) => trip.communityId === activeCommunityId),
    [trips, activeCommunityId]
  );

  React.useEffect(() => {
    async function resolveLocation() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") return;

        const coords = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        const geo = await Location.reverseGeocodeAsync({
          latitude: coords.coords.latitude,
          longitude: coords.coords.longitude
        });

        const place = geo[0];
        if (!place) return;
        const city = place.city || place.subregion || "Waterloo";
        const region = place.region || "ON";
        setLocationLabel(`${city}, ${region}`);
      } catch {
        setLocationLabel("Waterloo, ON");
      }
    }

    void resolveLocation();
  }, []);

  React.useEffect(() => {
    const first = trips.find((trip) => trip.communityId === activeCommunityId);
    setSelectedTripId(first?.id ?? "");
  }, [activeCommunityId, trips]);

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setIsRecording(true);
    } catch {
      Alert.alert("Recording error", "Could not start recording.");
    }
  }

  async function stopRecordingAndTranscribe() {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);

      if (!uri) {
        Alert.alert("Voice input", "No recording file found.");
        return;
      }

      const text = await transcribeWithGemini(uri);
      if (!text) {
        Alert.alert(
          "Speech-to-text unavailable",
          "Could not transcribe audio. Check EXPO_PUBLIC_API_BASE_URL and backend GEMINI_API_KEY."
        );
        return;
      }

      setTranscript(text);
      setTab("pantry");
      const ai = await generatePantrySuggestions(text, API_BASE_URL);
      setPantryResult({
        ...ai,
        suggestedRecipes: normalizeRecipeCount(ai.suggestedRecipes, ai.pantryItems)
      });
      setShowAllRecipes(false);
    } catch {
      Alert.alert("Voice input", "Something went wrong while transcribing.");
    }
  }
  async function transcribeWithGemini(uri: string): Promise<string | null> {
    if (!API_BASE_URL) return null;

    try {
      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });

      const response = await fetch(`${API_BASE_URL}/api/pantry/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          mimeType: "audio/m4a"
        })
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data?.text?.trim() || null;
    } catch {
      return null;
    }
  }

  function addToCart(itemId: string) {
    const item = groceryItems.find((i) => i.id === itemId);
    if (!item) return;

    setCart((prev) => {
      const existing = prev.find((line) => line.itemId === itemId);
      if (existing) {
        return prev.map((line) =>
          line.itemId === itemId
            ? { ...line, claimedUnits: Math.min(line.claimedUnits + 1, item.packCount) }
            : line
        );
      }
      return [...prev, { itemId, claimedUnits: 1 }];
    });
  }

  function getItemQty(itemId: string) {
    return cart.find((line) => line.itemId === itemId)?.claimedUnits ?? 0;
  }

  function decreaseQty(itemId: string) {
    setCart((prev) => {
      const line = prev.find((entry) => entry.itemId === itemId);
      if (!line) return prev;
      if (line.claimedUnits <= 1) {
        return prev.filter((entry) => entry.itemId !== itemId);
      }
      return prev.map((entry) =>
        entry.itemId === itemId ? { ...entry, claimedUnits: entry.claimedUnits - 1 } : entry
      );
    });
  }

  function attachOrderToTrip() {
    if (!selectedTripId || cart.length === 0) {
      Alert.alert("Attach order", "Choose a trip and add items first.");
      return;
    }

    setTrips((prev) =>
      prev.map((trip) =>
        trip.id === selectedTripId
          ? {
              ...trip,
              attachedOrders: [
                ...trip.attachedOrders,
                {
                  id: `o-${Date.now()}`,
                  userId: currentUserId,
                  notes: "Added from mobile app",
                  lines: cart
                }
              ]
            }
          : trip
      )
    );

    setCart([]);
    Alert.alert("Success", "Your grocery list was attached to the trip.");
    setTab("trips");
  }

  function joinCommunity(communityId: string) {
    setJoinedCommunityIds((prev) => (prev.includes(communityId) ? prev : [...prev, communityId]));
    setActiveCommunityId(communityId);
    const firstTrip = trips.find((trip) => trip.communityId === communityId);
    if (firstTrip) setSelectedTripId(firstTrip.id);
    Alert.alert("Community joined", "You are now viewing this community.");
  }

  function createTrip() {
    if (!joinedCommunityIds.includes(activeCommunityId)) {
      Alert.alert("Join community", "Join this community before creating a trip.");
      return;
    }
    if (!newTripPickup.trim() || !newTripDate.trim() || !newTripTime.trim()) {
      Alert.alert("Missing fields", "Add pickup location, date, and time.");
      return;
    }

    const when = `${newTripDate} ${newTripTime}`;
    const dateObj = new Date(`${newTripDate}T${newTripTime}:00`);
    const dayOfWeek = Number.isNaN(dateObj.getTime())
      ? "Custom Day"
      : dateObj.toLocaleDateString("en-US", { weekday: "long" });

    const trip: Trip = {
      id: `t-${Date.now()}`,
      communityId: activeCommunityId,
      runnerId: currentUserId,
      dayOfWeek,
      scheduledAt: when,
      pickupLocation: newTripPickup.trim(),
      status: "OPEN",
      attachedOrders: []
    };

    setTrips((prev) => [trip, ...prev]);
    setSelectedTripId(trip.id);
    setNewTripPickup("");
    Alert.alert("Trip created", `Your ${dayOfWeek} trip was posted.`);
  }

  function completeTrip(tripId: string) {
    setTrips((prev) =>
      prev.map((trip) =>
        trip.id === tripId && trip.runnerId === currentUserId
          ? { ...trip, status: "COMPLETED" }
          : trip
      )
    );
    Alert.alert("Trip completed", "Runner credit simulated and trip closed.");
  }

  async function runPantryAi() {
    if (!transcript.trim()) {
      Alert.alert("Pantry AI", "Add pantry items first.");
      return;
    }
    const res = await generatePantrySuggestions(transcript, API_BASE_URL);
    setPantryResult({
      ...res,
      suggestedRecipes: normalizeRecipeCount(res.suggestedRecipes, res.pantryItems)
    });
    setShowAllRecipes(false);
  }

  function renderShop() {
    return (
      <>
        <View style={styles.hero}>
          <View style={styles.searchRow}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder='Search for "Grocery"'
              placeholderTextColor="#7a8c8f"
              style={styles.searchInput}
            />
          </View>
          <Text style={styles.locationLabel}>Current Location</Text>
          <Text style={styles.locationValue}>{locationLabel} ↗</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>You might need</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {categoryOptions.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.catChip, c === category && styles.catChipActive]}
              onPress={() => setCategory(c)}
            >
              <Text style={styles.catChipText}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.grid}>
          {visibleItems.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.itemEmoji}>{productEmoji(item.category, item.name)}</Text>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>{item.packCount} {item.unitType} per pack</Text>
              <Text style={styles.itemMeta}>Category: {item.category}</Text>
              <Text style={styles.itemPrice}>${item.unitPriceCad.toFixed(2)} / unit</Text>
              <Text style={styles.itemMeta}>Pack: ${item.packPriceCad.toFixed(2)} CAD</Text>
              <View style={styles.qtyWrap}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => decreaseQty(item.id)}>
                  <Text style={styles.qtyBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{getItemQty(item.id)}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart(item.id)}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.quickPanel}>
          <Text style={styles.quickTitle}>What do you need to do?</Text>
          <View style={styles.quickButtons}>
            <TouchableOpacity
              style={[styles.quickButton, styles.quickButtonLeft]}
              onPress={() => setTab("trips")}
            >
              <Text style={styles.quickButtonText}>Create Costco Trip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickButton, styles.quickButtonRight]}
              onPress={() => setTab("trips")}
            >
              <Text style={styles.quickButtonText}>Attach to Trip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickButton, styles.quickButtonLeft]}
              onPress={() => setTab("trips")}
            >
              <Text style={styles.quickButtonText}>Split Multipacks</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickButton, styles.quickButtonRight]}
              onPress={() => setTab("pantry")}
            >
              <Text style={styles.quickButtonText}>AI Pantry Help</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.attachPanel}>
          <Text style={styles.attachTitle}>Cart ({cart.length}) attach to trip</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {tripsForActiveCommunity.map((trip) => (
              <TouchableOpacity
                key={trip.id}
                style={[styles.tripChip, selectedTripId === trip.id && styles.tripChipActive]}
                onPress={() => setSelectedTripId(trip.id)}
              >
                <Text style={styles.tripChipText}>{trip.dayOfWeek} · {trip.pickupLocation}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.attachButton} onPress={attachOrderToTrip}>
            <Text style={styles.attachButtonText}>Attach Grocery List</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  function renderTrips() {
    return (
      <>
        <Text style={styles.pageTitle}>Community Costco Trips</Text>
        <View style={styles.communityPanel}>
          <Text style={styles.communityTitle}>Browse and Join Communities</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {communities.map((community) => {
              const joined = joinedCommunityIds.includes(community.id);
              const active = activeCommunityId === community.id;
              return (
                <TouchableOpacity
                  key={community.id}
                  style={[styles.communityChip, active && styles.communityChipActive]}
                  onPress={() => (joined ? setActiveCommunityId(community.id) : joinCommunity(community.id))}
                >
                  <Text style={styles.communityName}>{community.name}</Text>
                  <Text style={styles.communityMeta}>
                    {community.area} · {community.distanceKm} km · {community.memberCount} members
                  </Text>
                  <Text style={styles.communityAction}>
                    {active ? "Active" : joined ? "Set Active" : "Join Community"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.createTripPanel}>
          <Text style={styles.communityTitle}>Create a Trip You Plan to Make</Text>
          <TextInput
            style={styles.createInput}
            value={newTripPickup}
            onChangeText={setNewTripPickup}
            placeholder="Pickup location (ex: Building A lobby)"
          />
          <View style={styles.createRow}>
            <TextInput
              style={[styles.createInput, styles.createInputHalf]}
              value={newTripDate}
              onChangeText={setNewTripDate}
              placeholder="YYYY-MM-DD"
            />
            <TextInput
              style={[styles.createInput, styles.createInputHalf]}
              value={newTripTime}
              onChangeText={setNewTripTime}
              placeholder="HH:MM"
            />
          </View>
          <TouchableOpacity style={styles.createTripBtn} onPress={createTrip}>
            <Text style={styles.createTripBtnText}>Post Trip</Text>
          </TouchableOpacity>
        </View>

        {tripsForActiveCommunity.map((trip) => {
          const runner = fakeUsers.find((u) => u.id === trip.runnerId);
          return (
            <View key={trip.id} style={styles.tripCard}>
              <Text style={styles.tripHeading}>{trip.dayOfWeek} · {trip.pickupLocation}</Text>
              <Text style={styles.tripMeta}>Scheduled: {trip.scheduledAt}</Text>
              <Text style={styles.tripMeta}>
                Runner: {runner?.name} · ⭐ {runner?.rating} · Completed: {runner?.completedTrips}
              </Text>
              <Text style={styles.tripMeta}>Attached orders: {trip.attachedOrders.length} · Status: {trip.status}</Text>

              {trip.attachedOrders.map((order) => {
                const orderUser = fakeUsers.find((u) => u.id === order.userId);
                return (
                  <View key={order.id} style={styles.orderRow}>
                    <Text style={styles.orderName}>{orderUser?.name}</Text>
                    <Text style={styles.orderItems}>
                      {order.lines
                        .map((line) => {
                          const item = groceryItems.find((i) => i.id === line.itemId);
                          return `${item?.name} (${line.claimedUnits})`;
                        })
                        .join(", ")}
                    </Text>
                  </View>
                );
              })}

              {trip.runnerId === currentUserId && trip.status === "OPEN" ? (
                <TouchableOpacity style={styles.completeBtn} onPress={() => completeTrip(trip.id)}>
                  <Text style={styles.completeBtnText}>Complete Trip + Earn Credit</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </>
    );
  }

  function renderPantry() {
    const visibleRecipes = pantryResult
      ? showAllRecipes
        ? pantryResult.suggestedRecipes
        : pantryResult.suggestedRecipes.slice(0, 5)
      : [];

    return (
      <>
        <Text style={styles.pageTitle}>AI Pantry Assistant</Text>
        <Text style={styles.tripMeta}>Speak or type pantry inventory and generate recipes.</Text>
        <TextInput
          style={styles.pantryInput}
          multiline
          value={transcript}
          onChangeText={setTranscript}
          placeholder="eggs, milk, spinach, pasta"
        />
        <TouchableOpacity style={styles.generateBtn} onPress={runPantryAi}>
          <Text style={styles.generateBtnText}>Generate Recipes</Text>
        </TouchableOpacity>

        {pantryResult ? (
          <View style={styles.resultWrap}>
            <Text style={styles.tripMeta}>Mode: {pantryResult.provider === "api" ? "Gemini API" : "Fallback"}</Text>
            {pantryResult.warning ? <Text style={styles.warnText}>{pantryResult.warning}</Text> : null}
            {visibleRecipes.map((recipe) => (
              <View key={recipe.title} style={styles.recipeCard}>
                <Text style={styles.recipeTitle}>{recipe.title}</Text>
                <Text style={styles.tripMeta}>Missing: {recipe.missingIngredients.join(", ") || "Nothing"}</Text>
              </View>
            ))}
            {pantryResult.suggestedRecipes.length > 5 ? (
              <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAllRecipes((p) => !p)}>
                <Text style={styles.showMoreBtnText}>{showAllRecipes ? "Show less" : "Show more"}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </>
    );
  }

  function renderProfile() {
    const me = fakeUsers.find((u) => u.id === currentUserId);
    const activeCommunity = communities.find((c) => c.id === activeCommunityId);
    return (
      <>
        <Text style={styles.pageTitle}>Profile</Text>
        <View style={styles.profileCard}>
          <Text style={styles.tripHeading}>{me?.name}</Text>
          <Text style={styles.tripMeta}>Rating: ⭐ {me?.rating}</Text>
          <Text style={styles.tripMeta}>Completed trips: {me?.completedTrips}</Text>
          <Text style={styles.tripMeta}>Active community: {activeCommunity?.name ?? "None"}</Text>
          <Text style={styles.tripMeta}>Joined communities: {joinedCommunityIds.length}</Text>
        </View>
      </>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        {tab === "shop" && renderShop()}
        {tab === "trips" && renderTrips()}
        {tab === "pantry" && renderPantry()}
        {tab === "profile" && renderProfile()}
      </ScrollView>

      <View style={styles.bottomNav}>
        <NavButton label="Shop" active={tab === "shop"} onPress={() => setTab("shop")} />
        <NavButton label="Trips" active={tab === "trips"} onPress={() => setTab("trips")} />
        <NavButton label="Pantry" active={tab === "pantry"} onPress={() => setTab("pantry")} />
        <NavButton label="Profile" active={tab === "profile"} onPress={() => setTab("profile")} />
      </View>
    </SafeAreaView>
  );
}

function NavButton({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.navBtn, active && styles.navBtnActive]} onPress={onPress}>
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#e6e9e8" },
  content: { paddingBottom: 100 },
  hero: {
    backgroundColor: "#004448",
    padding: 14,
    borderBottomLeftRadius: 44,
    borderBottomRightRadius: 44
  },
  searchRow: { flexDirection: "row", alignItems: "center" },
  searchInput: {
    backgroundColor: "#f2f4f4",
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#335",
    flex: 1
  },
  locationLabel: { color: "#d2e7e8", marginTop: 14, fontSize: 15 },
  locationValue: { color: "#c5e89f", fontSize: 30, fontWeight: "800" },
  sectionHeader: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: { fontSize: 38, fontWeight: "900", color: "#0d3b3a" },
  catChip: {
    marginLeft: 14,
    marginBottom: 6,
    backgroundColor: "#efefef",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  catChipActive: { backgroundColor: "#ffd36b" },
  catChipText: { color: "#2f5251", fontWeight: "700" },
  grid: {
    paddingHorizontal: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between"
  },
  card: {
    width: "48.5%",
    backgroundColor: "#f8f9f8",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eceeed",
    padding: 10,
    marginBottom: 8
  },
  itemEmoji: { fontSize: 46, textAlign: "center" },
  itemName: { marginTop: 6, fontSize: 20, fontWeight: "700", color: "#163f3c" },
  itemMeta: { color: "#778a8f", marginTop: 4 },
  itemPrice: { fontSize: 34, fontWeight: "900", color: "#0f3d3b", marginTop: 6 },
  qtyWrap: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "#eceee8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#dfe6e0",
    alignItems: "center",
    justifyContent: "center"
  },
  qtyBtnText: { fontSize: 24, color: "#103f3d", fontWeight: "800", lineHeight: 26 },
  qtyValue: { minWidth: 30, textAlign: "center", fontSize: 22, fontWeight: "800", color: "#103f3d" },
  quickPanel: { marginHorizontal: 14, marginTop: 8 },
  quickTitle: { fontSize: 20, fontWeight: "800", color: "#103e3c", marginBottom: 8 },
  quickButtons: { flexDirection: "row", flexWrap: "wrap" },
  quickButton: {
    backgroundColor: "#f3dfad",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: "48%",
    marginBottom: 8
  },
  quickButtonLeft: { marginRight: "4%" },
  quickButtonRight: { marginRight: 0 },
  quickButtonText: { color: "#624b13", fontWeight: "800" },
  attachPanel: {
    marginHorizontal: 14,
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dde3e2"
  },
  attachTitle: { fontSize: 17, fontWeight: "700", color: "#143f3d", marginBottom: 8 },
  tripChip: {
    backgroundColor: "#eef1f1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8
  },
  tripChipActive: { backgroundColor: "#d2ede9" },
  tripChipText: { color: "#204f4b", fontWeight: "700" },
  attachButton: {
    marginTop: 10,
    backgroundColor: "#0b6b60",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 12
  },
  attachButtonText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  pageTitle: {
    fontSize: 34,
    fontWeight: "900",
    color: "#103d3b",
    marginTop: 12,
    marginHorizontal: 14,
    marginBottom: 10
  },
  tripCard: {
    marginHorizontal: 14,
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderColor: "#dce2e1",
    borderWidth: 1,
    padding: 12
  },
  tripHeading: { fontSize: 20, fontWeight: "800", color: "#0f3d3b" },
  tripMeta: { color: "#62767a", marginTop: 4, fontSize: 14 },
  communityPanel: {
    marginHorizontal: 14,
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderColor: "#dce2e1",
    borderWidth: 1,
    padding: 10
  },
  communityTitle: { color: "#0f3d3b", fontSize: 17, fontWeight: "800", marginBottom: 8 },
  communityChip: {
    width: 250,
    backgroundColor: "#f3f6f6",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e1e8e7",
    padding: 10,
    marginRight: 8
  },
  communityChipActive: { borderColor: "#8cd2bf", backgroundColor: "#e8f8f3" },
  communityName: { color: "#123e3b", fontSize: 16, fontWeight: "800" },
  communityMeta: { color: "#62767a", marginTop: 4, fontSize: 13 },
  communityAction: { color: "#0b6b60", marginTop: 8, fontWeight: "800" },
  createTripPanel: {
    marginHorizontal: 14,
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderColor: "#dce2e1",
    borderWidth: 1,
    padding: 10
  },
  createInput: {
    backgroundColor: "#f5f8f8",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dce2e1",
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8
  },
  createRow: { flexDirection: "row", justifyContent: "space-between" },
  createInputHalf: { width: "48.5%" },
  createTripBtn: {
    backgroundColor: "#0b6b60",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 11
  },
  createTripBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  orderRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eef2f2"
  },
  orderName: { color: "#143f3d", fontWeight: "700" },
  orderItems: { color: "#50666a", marginTop: 3 },
  completeBtn: {
    marginTop: 10,
    backgroundColor: "#efb94a",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10
  },
  completeBtnText: { color: "#4c3300", fontWeight: "900" },
  pantryInput: {
    marginHorizontal: 14,
    minHeight: 86,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dce2e1",
    borderRadius: 12,
    padding: 12,
    textAlignVertical: "top"
  },
  generateBtn: {
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: "#0b6b60",
    alignItems: "center",
    paddingVertical: 12
  },
  generateBtnText: { color: "white", fontWeight: "900", fontSize: 16 },
  resultWrap: { marginHorizontal: 14, marginTop: 10 },
  warnText: { color: "#b42318", marginTop: 4 },
  recipeCard: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dce2e1",
    borderRadius: 10,
    padding: 10
  },
  showMoreBtn: {
    marginTop: 10,
    backgroundColor: "#eaf4f2",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10
  },
  showMoreBtnText: { color: "#0f3d3b", fontWeight: "800" },
  recipeTitle: { color: "#123e3b", fontWeight: "800", fontSize: 16 },
  profileCard: {
    marginHorizontal: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dce2e1",
    borderRadius: 12,
    padding: 12
  },
  bottomNav: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 18,
    borderRadius: 28,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dde3e2",
    flexDirection: "row",
    padding: 5
  },
  navBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    paddingVertical: 10
  },
  navBtnActive: { backgroundColor: "#dbf0e9" },
  navText: { color: "#6e8185", fontWeight: "700" },
  navTextActive: { color: "#0f3d3b" }
});
