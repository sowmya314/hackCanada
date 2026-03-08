import React, { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
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
import DateTimePicker from "@react-native-community/datetimepicker";
import { communities, fakeUsers, groceryItems, seededTrips, type Trip } from "./src/data/mock";
import { generatePantrySuggestions } from "./src/lib/pantry";

type Tab = "shop" | "trips" | "pantry" | "profile";

type CartLine = { itemId: string; claimedUnits: number };
const QTY_STEP = 0.5;

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

function productEmoji(name: string, category: string) {
  const n = name.toLowerCase();
  const c = category.toLowerCase();
  if (n.includes("egg")) return "🥚";
  if (n.includes("avocado")) return "🥑";
  if (n.includes("rice")) return "🍚";
  if (n.includes("milk")) return "🥛";
  if (n.includes("bread") || c.includes("bakery")) return "🍞";
  if (n.includes("cheese")) return "🧀";
  if (n.includes("chicken")) return "🍗";
  if (n.includes("beef") || n.includes("steak")) return "🥩";
  if (n.includes("fish") || n.includes("salmon") || n.includes("tuna")) return "🐟";
  if (n.includes("shrimp")) return "🦐";
  if (n.includes("broccoli")) return "🥦";
  if (n.includes("carrot")) return "🥕";
  if (n.includes("potato")) return "🥔";
  if (n.includes("onion")) return "🧅";
  if (n.includes("tomato")) return "🍅";
  if (n.includes("apple")) return "🍎";
  if (n.includes("banana")) return "🍌";
  if (n.includes("orange")) return "🍊";
  if (n.includes("strawberry")) return "🍓";
  if (n.includes("blueberr")) return "🫐";
  if (n.includes("pasta") || n.includes("spaghetti") || n.includes("noodle")) return "🍝";
  if (n.includes("oatmeal") || n.includes("granola")) return "🥣";
  if (n.includes("cereal")) return "🥣";
  if (n.includes("water")) return "💧";
  if (n.includes("coffee")) return "☕";
  if (n.includes("tea")) return "🍵";
  if (n.includes("juice")) return "🧃";
  if (n.includes("soda") || n.includes("cola") || n.includes("sprite")) return "🥤";
  if (n.includes("cookie") || n.includes("biscuit")) return "🍪";
  if (n.includes("chocolate")) return "🍫";
  if (n.includes("chip")) return "🥔";
  if (n.includes("clean") || n.includes("detergent") || n.includes("soap")) return "🧴";
  if (c.includes("dairy")) return "🥛";
  if (c.includes("drinks")) return "🥤";
  if (c.includes("snack")) return "🍿";
  if (c.includes("frozen")) return "🧊";
  if (c.includes("produce")) return "🥬";
  return "🛒";
}

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function proratedLineTotal(packPriceCad: number, requestedPackQty: number) {
  return Number((packPriceCad * requestedPackQty).toFixed(2));
}

export default function App() {
  const [tab, setTab] = useState<Tab>("shop");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [trips, setTrips] = useState<Trip[]>(seededTrips);
  const [communityPool, setCommunityPool] = useState<
    Record<string, Array<{ itemId: string; name: string; units: number }>>
  >({
    c1: [],
    c2: [],
    c3: [],
  });
  const [joinedCommunityIds, setJoinedCommunityIds] = useState<string[]>(["c1"]);
  const [activeCommunityId, setActiveCommunityId] = useState("c1");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedTripId, setSelectedTripId] = useState(
    seededTrips.find((trip) => trip.communityId === "c1")?.id ?? ""
  );
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [locationLabel, setLocationLabel] = useState("Waterloo, ON");
  const [myCoords, setMyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedTripDate, setSelectedTripDate] = useState<string | null>(null);
  const [newTripDateTime, setNewTripDateTime] = useState(new Date("2026-03-14T12:30:00"));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
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
        setMyCoords({ lat: coords.coords.latitude, lng: coords.coords.longitude });

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
    setSelectedTripDate(null);
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
        const next = Math.min(10, roundToHalf(existing.claimedUnits + QTY_STEP));
        return prev.map((line) =>
          line.itemId === itemId
            ? { ...line, claimedUnits: next }
            : line
        );
      }
      return [...prev, { itemId, claimedUnits: QTY_STEP }];
    });
  }

  function getItemQty(itemId: string) {
    return cart.find((line) => line.itemId === itemId)?.claimedUnits ?? 0;
  }

  function decreaseQty(itemId: string) {
    setCart((prev) => {
      const line = prev.find((entry) => entry.itemId === itemId);
      if (!line) return prev;
      const next = roundToHalf(line.claimedUnits - QTY_STEP);
      if (next <= 0) {
        return prev.filter((entry) => entry.itemId !== itemId);
      }
      return prev.map((entry) =>
        entry.itemId === itemId ? { ...entry, claimedUnits: next } : entry
      );
    });
  }

  function cartDisplayLines() {
    return cart
      .map((line) => {
        const item = groceryItems.find((entry) => entry.id === line.itemId);
        if (!item) return null;
        return {
          ...line,
          item,
          lineTotal: proratedLineTotal(item.packPriceCad, line.claimedUnits),
        };
      })
      .filter((entry): entry is { itemId: string; claimedUnits: number; item: (typeof groceryItems)[number]; lineTotal: number } => Boolean(entry));
  }

  function cartTotals() {
    const lines = cartDisplayLines();
    const itemsCount = lines.reduce((sum, line) => sum + line.claimedUnits, 0);
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    return { itemsCount, subtotal };
  }

  function computeTripPickupPlan(trip: Trip) {
    const map = new Map<
      string,
      {
        itemId: string;
        name: string;
        unitType: string;
        unitsPerPack: number;
        requestedPackQty: number;
      }
    >();

    for (const order of trip.attachedOrders) {
      for (const line of order.lines) {
        const item = groceryItems.find((entry) => entry.id === line.itemId);
        if (!item) continue;
        const existing = map.get(line.itemId);
        if (existing) {
          existing.requestedPackQty = roundToHalf(existing.requestedPackQty + line.claimedUnits);
        } else {
          map.set(line.itemId, {
            itemId: line.itemId,
            name: item.name,
            unitType: item.unitType,
            unitsPerPack: item.packCount,
            requestedPackQty: line.claimedUnits,
          });
        }
      }
    }

    return Array.from(map.values())
      .map((row) => {
        const packsToBuy = Math.ceil(row.requestedPackQty);
        const requestedUnits = row.requestedPackQty * row.unitsPerPack;
        const providedUnits = packsToBuy * row.unitsPerPack;
        const extraUnits = providedUnits - requestedUnits;
        return { ...row, requestedUnits, packsToBuy, providedUnits, extraUnits };
      })
      .sort((a, b) => b.packsToBuy - a.packsToBuy || a.name.localeCompare(b.name));
  }

  function parseTripDateKey(scheduledAt: string) {
    const isoPart = scheduledAt.split(" ")[0];
    return isoPart;
  }

  function parseTripTime(scheduledAt: string) {
    const t = scheduledAt.split(" ")[1] ?? "";
    return t;
  }

  function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function buildCalendarDays() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const leadingBlanks = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const cells: Array<{ key: string; label: string; isBlank: boolean; dateKey?: string }> = [];

    for (let i = 0; i < leadingBlanks; i += 1) {
      cells.push({ key: `b-${i}`, label: "", isBlank: true });
    }
    for (let d = 1; d <= totalDays; d += 1) {
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      const dateKey = `${year}-${mm}-${dd}`;
      cells.push({ key: dateKey, label: String(d), isBlank: false, dateKey });
    }
    return cells;
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

  function attachOrderAndPay() {
    if (!selectedTripId || cart.length === 0) {
      Alert.alert("Attach & pay", "Choose a trip and add items first.");
      return;
    }
    const total = cart.reduce((sum, line) => {
      const item = groceryItems.find((entry) => entry.id === line.itemId);
      if (!item) return sum;
      return sum + proratedLineTotal(item.packPriceCad, line.claimedUnits);
    }, 0);

    attachOrderToTrip();
    Alert.alert("Payment complete", `You paid $${total.toFixed(2)} CAD and attached your grocery list.`);
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
    if (!newTripPickup.trim()) {
      Alert.alert("Missing fields", "Add pickup location, date, and time.");
      return;
    }

    const dateObj = newTripDateTime;
    const yyyy = String(dateObj.getFullYear());
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(dateObj.getDate()).padStart(2, "0");
    const hh = String(dateObj.getHours()).padStart(2, "0");
    const min = String(dateObj.getMinutes()).padStart(2, "0");
    const when = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
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

  function dateLabel(date: Date) {
    return date.toLocaleDateString("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  function timeLabel(date: Date) {
    return date.toLocaleTimeString("en-CA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  function completeTrip(tripId: string) {
    const trip = trips.find((entry) => entry.id === tripId);
    const pickupPlan = trip ? computeTripPickupPlan(trip) : [];
    const extras = pickupPlan
      .filter((row) => row.extraUnits > 0)
      .map((row) => ({ itemId: row.itemId, name: row.name, units: row.extraUnits }));

    setTrips((prev) =>
      prev.map((trip) =>
        trip.id === tripId && trip.runnerId === currentUserId
          ? { ...trip, status: "COMPLETED" }
          : trip
      )
    );
    if (trip && extras.length > 0) {
      setCommunityPool((prev) => {
        const current = prev[trip.communityId] ?? [];
        const merged = [...current];
        for (const extra of extras) {
          const existing = merged.find((item) => item.itemId === extra.itemId);
          if (existing) existing.units += extra.units;
          else merged.push(extra);
        }
        return { ...prev, [trip.communityId]: merged };
      });
    }

    const extraCount = extras.reduce((sum, e) => sum + e.units, 0);
    Alert.alert(
      "Trip completed",
      extraCount > 0
        ? `Trip closed. ${extraCount} extra units moved to Community Leftover Pool.`
        : "Trip closed. No leftover units."
    );
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

        <View style={styles.attachPanel}>
          <View style={styles.attachHeaderRow}>
            <View>
              <Text style={styles.attachTitle}>Your Cart</Text>
              <Text style={styles.attachSubtext}>
                {formatQty(cartTotals().itemsCount)} packs · ${cartTotals().subtotal.toFixed(2)} CAD
              </Text>
            </View>
            <TouchableOpacity style={styles.viewCartBtn} onPress={() => setCartModalVisible(true)}>
              <Text style={styles.viewCartBtnText}>View Cart</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.attachSubLabel}>Attach to trip</Text>
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
          {(communityPool[activeCommunityId] ?? []).length > 0 ? (
            <View style={styles.poolBox}>
              <Text style={styles.poolTitle}>Community Leftover Pool</Text>
              <Text style={styles.poolMeta}>
                Extra units from previous trips are stored here for future claims.
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {(communityPool[activeCommunityId] ?? []).map((poolItem) => (
                  <View key={poolItem.itemId} style={styles.poolChip}>
                    <Text style={styles.poolChipName}>{poolItem.name}</Text>
                    <Text style={styles.poolChipUnits}>{poolItem.units} units available</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
          <TouchableOpacity style={styles.attachButton} onPress={attachOrderAndPay}>
            <Text style={styles.attachButtonText}>Attach Grocery List & Pay</Text>
          </TouchableOpacity>
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
              <View style={styles.itemIconWrap}>
                <Text style={styles.itemIcon}>{productEmoji(item.name, item.category)}</Text>
              </View>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>{item.packCount} {item.unitType} per pack</Text>
              <Text style={styles.itemMeta}>Category: {item.category}</Text>
              <Text style={styles.itemPrice}>${item.packPriceCad.toFixed(2)} per pack</Text>
              <Text style={styles.itemMeta}>Qty is in pack portions (0.5 = half pack)</Text>
              <View style={styles.qtyWrap}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => decreaseQty(item.id)}>
                  <Text style={styles.qtyBtnText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{formatQty(getItemQty(item.id))}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart(item.id)}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

      </>
    );
  }

  function renderTrips() {
    const tripsByDate = new Map<string, Trip[]>();
    for (const trip of tripsForActiveCommunity) {
      const key = parseTripDateKey(trip.scheduledAt);
      const arr = tripsByDate.get(key) ?? [];
      arr.push(trip);
      tripsByDate.set(key, arr);
    }
    const calendarCells = buildCalendarDays();
    const selectedDateTrips = selectedTripDate ? tripsByDate.get(selectedTripDate) ?? [] : [];

    return (
      <>
        <Text style={styles.pageTitle}>Community Costco Trips</Text>
        <View style={styles.calendarPanel}>
          <Text style={styles.communityTitle}>Trip Calendar</Text>
          <View style={styles.weekHeader}>
            {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
              <Text key={`${day}-${idx}`} style={styles.weekHeaderText}>{day}</Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {calendarCells.map((cell) => {
              if (cell.isBlank) return <View key={cell.key} style={styles.dayCellBlank} />;
              const tripCount = cell.dateKey ? (tripsByDate.get(cell.dateKey)?.length ?? 0) : 0;
              const highlighted = tripCount > 0;
              const selected = selectedTripDate === cell.dateKey;
              return (
                <TouchableOpacity
                  key={cell.key}
                  style={[
                    styles.dayCell,
                    highlighted && styles.dayCellHighlighted,
                    selected && styles.dayCellSelected,
                  ]}
                  onPress={() => setSelectedTripDate(cell.dateKey ?? null)}
                >
                  <Text style={[styles.dayCellText, highlighted && styles.dayCellTextHighlighted]}>
                    {cell.label}
                  </Text>
                  {tripCount > 0 ? <Text style={styles.dayCellCount}>{tripCount}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedTripDate && selectedDateTrips.length > 0 ? (
            <View style={styles.dayDropdown}>
              <Text style={styles.dayDropdownTitle}>
                {selectedDateTrips.length > 1 ? "Trips this day" : "Trip this day"}
              </Text>
              {selectedDateTrips.map((trip) => {
                const runner = fakeUsers.find((u) => u.id === trip.runnerId);
                const distanceKm =
                  runner && myCoords
                    ? haversineKm(myCoords.lat, myCoords.lng, runner.homeLat, runner.homeLng)
                    : null;
                return (
                  <View key={`dd-${trip.id}`} style={styles.dayTripCard}>
                    <Text style={styles.dayTripTitle}>{parseTripTime(trip.scheduledAt)} · {trip.pickupLocation}</Text>
                    <Text style={styles.tripMeta}>
                      {runner?.name} · ⭐ {runner?.rating} · {runner?.completedTrips} trips
                    </Text>
                    <Text style={styles.tripMeta}>
                      Distance from you: {distanceKm == null ? "N/A" : `${distanceKm.toFixed(1)} km`}
                    </Text>
                    <Text style={styles.tripMeta}>{runner?.bio ?? "Reliable community runner."}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
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
            <TouchableOpacity
              style={[styles.createInput, styles.createInputHalf, styles.pickerField]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.pickerLabel}>Date</Text>
              <Text style={styles.pickerValue}>{dateLabel(newTripDateTime)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createInput, styles.createInputHalf, styles.pickerField]}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.pickerLabel}>Time</Text>
              <Text style={styles.pickerValue}>{timeLabel(newTripDateTime)}</Text>
            </TouchableOpacity>
          </View>
          {showDatePicker ? (
            <DateTimePicker
              value={newTripDateTime}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(_event, selectedDate) => {
                setShowDatePicker(Platform.OS === "ios");
                if (!selectedDate) return;
                const next = new Date(newTripDateTime);
                next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                setNewTripDateTime(next);
              }}
            />
          ) : null}
          {showTimePicker ? (
            <DateTimePicker
              value={newTripDateTime}
              mode="time"
              is24Hour={false}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_event, selectedTime) => {
                setShowTimePicker(Platform.OS === "ios");
                if (!selectedTime) return;
                const next = new Date(newTripDateTime);
                next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
                setNewTripDateTime(next);
              }}
            />
          ) : null}
          <TouchableOpacity style={styles.createTripBtn} onPress={createTrip}>
            <Text style={styles.createTripBtnText}>Post Trip</Text>
          </TouchableOpacity>
        </View>

        {tripsForActiveCommunity.map((trip) => {
          const runner = fakeUsers.find((u) => u.id === trip.runnerId);
          const pickupPlan = computeTripPickupPlan(trip);
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
                          return `${item?.name} (${formatQty(line.claimedUnits)} packs)`;
                        })
                        .join(", ")}
                    </Text>
                  </View>
                );
              })}

              {pickupPlan.length > 0 ? (
                <View style={styles.pickupPlanBox}>
                  <Text style={styles.pickupPlanTitle}>Runner Pickup Plan</Text>
                  {pickupPlan.map((row) => (
                    <View key={row.itemId} style={styles.pickupPlanRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickupPlanItem}>{row.name}</Text>
                        <Text style={styles.pickupPlanMeta}>
                          Requested: {formatQty(row.requestedPackQty)} packs (~{formatQty(row.requestedUnits)} {row.unitType})
                        </Text>
                      </View>
                      <View style={styles.pickupPlanBadge}>
                        <Text style={styles.pickupPlanBadgeMain}>{row.packsToBuy} packs</Text>
                        <Text style={styles.pickupPlanBadgeSub}>
                          ({row.unitsPerPack}/pack)
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

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

      <Modal visible={cartModalVisible} animationType="slide" transparent onRequestClose={() => setCartModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Your Cart</Text>
              <TouchableOpacity onPress={() => setCartModalVisible(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSummary}>
              {formatQty(cartTotals().itemsCount)} packs · Subtotal ${cartTotals().subtotal.toFixed(2)} CAD
            </Text>

            <ScrollView style={{ maxHeight: 360 }}>
              {cartDisplayLines().length === 0 ? (
                <Text style={styles.tripMeta}>Your cart is empty.</Text>
              ) : (
                cartDisplayLines().map((line) => (
                  <View key={line.itemId} style={styles.modalLine}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalItemName}>{line.item.name}</Text>
                      <Text style={styles.modalItemMeta}>
                        ${line.item.packPriceCad.toFixed(2)} per pack · ${line.lineTotal.toFixed(2)} total
                      </Text>
                    </View>
                    <View style={styles.modalQtyWrap}>
                      <TouchableOpacity style={styles.modalQtyBtn} onPress={() => decreaseQty(line.itemId)}>
                        <Text style={styles.modalQtyBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.modalQtyValue}>{formatQty(line.claimedUnits)}</Text>
                      <TouchableOpacity style={styles.modalQtyBtn} onPress={() => addToCart(line.itemId)}>
                        <Text style={styles.modalQtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.attachButton, { marginTop: 12 }]}
              onPress={() => {
                setCartModalVisible(false);
                attachOrderAndPay();
              }}
            >
              <Text style={styles.attachButtonText}>Attach Grocery List & Pay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  itemImage: {
    display: "none"
  },
  itemIconWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignSelf: "center",
    marginTop: 4,
    backgroundColor: "#fff8df",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#f3ddb1"
  },
  itemIcon: { fontSize: 44 },
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
  attachPanel: {
    marginHorizontal: 14,
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dde3e2"
  },
  attachHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  attachTitle: { fontSize: 18, fontWeight: "800", color: "#143f3d" },
  attachSubtext: { marginTop: 2, color: "#5f7679", fontSize: 13, fontWeight: "600" },
  attachSubLabel: { marginTop: 10, marginBottom: 6, color: "#5f7679", fontSize: 13, fontWeight: "700" },
  poolBox: {
    marginTop: 10,
    marginBottom: 2,
    backgroundColor: "#f4faf8",
    borderWidth: 1,
    borderColor: "#dfece8",
    borderRadius: 12,
    padding: 10,
  },
  poolTitle: { color: "#123e3b", fontWeight: "900", marginBottom: 4 },
  poolMeta: { color: "#60757a", fontSize: 12, marginBottom: 8 },
  poolChip: {
    backgroundColor: "#e2f2ee",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
  },
  poolChipName: { color: "#0f3d3b", fontWeight: "800", fontSize: 12 },
  poolChipUnits: { color: "#4d666a", fontWeight: "700", fontSize: 11, marginTop: 2 },
  viewCartBtn: {
    backgroundColor: "#e5f3f0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999
  },
  viewCartBtnText: { color: "#0f3d3b", fontWeight: "800" },
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
    marginTop: 12,
    backgroundColor: "#0b6b60",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 13
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
  calendarPanel: {
    marginHorizontal: 14,
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderColor: "#dce2e1",
    borderWidth: 1,
    padding: 10
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 6,
    paddingHorizontal: 0
  },
  weekHeaderText: { width: "14.2857%", textAlign: "center", color: "#6b7f83", fontWeight: "700", fontSize: 12 },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start"
  },
  dayCellBlank: { width: "14.2857%", aspectRatio: 1, marginBottom: 6 },
  dayCell: {
    width: "14.2857%",
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eef2f1",
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafcfc"
  },
  dayCellHighlighted: {
    backgroundColor: "#e8f8f3",
    borderColor: "#bfe5d9"
  },
  dayCellSelected: {
    borderColor: "#0b6b60",
    borderWidth: 2
  },
  dayCellText: { color: "#3f5559", fontWeight: "700" },
  dayCellTextHighlighted: { color: "#0f3d3b" },
  dayCellCount: { marginTop: 2, fontSize: 10, color: "#0b6b60", fontWeight: "800" },
  dayDropdown: {
    marginTop: 8,
    backgroundColor: "#f7fbfa",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e3ecea",
    padding: 8
  },
  dayDropdownTitle: { color: "#123e3b", fontWeight: "900", marginBottom: 6 },
  dayTripCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3ecea",
    borderRadius: 10,
    padding: 8,
    marginBottom: 6
  },
  dayTripTitle: { color: "#103d3b", fontWeight: "800", fontSize: 14 },
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
  pickerField: { justifyContent: "center" },
  pickerLabel: { color: "#6d8185", fontSize: 12, fontWeight: "700", marginBottom: 2 },
  pickerValue: { color: "#133f3d", fontSize: 16, fontWeight: "800" },
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
  pickupPlanBox: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: "#f7fbfa",
    borderWidth: 1,
    borderColor: "#e3ecea",
    padding: 10,
  },
  pickupPlanTitle: { color: "#123e3b", fontWeight: "900", marginBottom: 8 },
  pickupPlanRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  pickupPlanItem: { color: "#173f3c", fontWeight: "700", fontSize: 14 },
  pickupPlanMeta: { color: "#60757a", marginTop: 2, fontSize: 12 },
  pickupPlanBadge: {
    backgroundColor: "#e2f2ee",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "flex-end",
  },
  pickupPlanBadgeMain: { color: "#0f3d3b", fontWeight: "900", fontSize: 13 },
  pickupPlanBadgeSub: { color: "#4d666a", fontWeight: "700", fontSize: 11 },
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
  navTextActive: { color: "#0f3d3b" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end"
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    borderColor: "#dde3e2",
    borderWidth: 1
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  modalTitle: { fontSize: 22, fontWeight: "900", color: "#103d3b" },
  modalClose: { color: "#0f3d3b", fontWeight: "800", fontSize: 14 },
  modalSummary: { color: "#4f6669", marginBottom: 10, fontWeight: "700" },
  modalLine: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fbfa",
    borderColor: "#e6eeec",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8
  },
  modalItemName: { color: "#123e3b", fontWeight: "800", fontSize: 15 },
  modalItemMeta: { color: "#62767a", marginTop: 4, fontSize: 13 },
  modalQtyWrap: { flexDirection: "row", alignItems: "center", marginLeft: 10 },
  modalQtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#dfe6e0",
    alignItems: "center",
    justifyContent: "center"
  },
  modalQtyBtnText: { fontSize: 20, color: "#103f3d", fontWeight: "800", lineHeight: 22 },
  modalQtyValue: { minWidth: 28, textAlign: "center", fontSize: 18, fontWeight: "800", color: "#103f3d" }
});
