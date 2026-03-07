export type FakeUser = {
  id: string;
  name: string;
  rating: number;
  completedTrips: number;
};

export type GroceryItem = {
  id: string;
  name: string;
  category: string;
  grams: number;
  packCount: number;
  unitType: string;
  price: number;
  emoji: string;
};

export type AttachedOrder = {
  id: string;
  userId: string;
  notes: string;
  lines: Array<{ itemId: string; claimedUnits: number }>;
};

export type Trip = {
  id: string;
  communityId: string;
  runnerId: string;
  dayOfWeek: string;
  scheduledAt: string;
  pickupLocation: string;
  status: "OPEN" | "COMPLETED";
  attachedOrders: AttachedOrder[];
};

export type Community = {
  id: string;
  name: string;
  area: string;
  distanceKm: number;
  memberCount: number;
};

export const communities: Community[] = [
  { id: "c1", name: "Downtown Towers", area: "Uptown Waterloo", distanceKm: 0.9, memberCount: 41 },
  { id: "c2", name: "Campus South", area: "University District", distanceKm: 2.3, memberCount: 84 },
  { id: "c3", name: "Laurelwood Neighbors", area: "West Waterloo", distanceKm: 4.7, memberCount: 26 }
];

export const fakeUsers: FakeUser[] = [
  { id: "u1", name: "Maya", rating: 4.9, completedTrips: 21 },
  { id: "u2", name: "Jordan", rating: 4.7, completedTrips: 14 },
  { id: "u3", name: "Arjun", rating: 4.8, completedTrips: 17 },
  { id: "u4", name: "Nina", rating: 4.6, completedTrips: 10 }
];

export const groceryItems: GroceryItem[] = [
  { id: "i1", name: "Beetroot", category: "Fresh", grams: 500, packCount: 1, unitType: "bag", price: 17.29, emoji: "🧅" },
  { id: "i2", name: "Italian Avocado", category: "Fresh", grams: 450, packCount: 6, unitType: "pieces", price: 14.29, emoji: "🥑" },
  { id: "i3", name: "Deshi Carrot", category: "Fresh", grams: 1000, packCount: 1, unitType: "bag", price: 27.29, emoji: "🥕" },
  { id: "i4", name: "Sparkling Water", category: "Drink & Water", grams: 330, packCount: 12, unitType: "cans", price: 12.49, emoji: "🥤" },
  { id: "i5", name: "Croissant Box", category: "Bakery", grams: 600, packCount: 8, unitType: "pieces", price: 9.99, emoji: "🥐" },
  { id: "i6", name: "Dairy Milk", category: "Dairy", grams: 1000, packCount: 2, unitType: "bottles", price: 8.49, emoji: "🥛" },
  { id: "i7", name: "Floor Cleaner", category: "Cleaners", grams: 1000, packCount: 3, unitType: "bottles", price: 11.29, emoji: "🧴" },
  { id: "i8", name: "Protein Chicken Mix", category: "Meat", grams: 1000, packCount: 4, unitType: "packs", price: 22.1, emoji: "🍖" },
  { id: "i9", name: "Snack Pack", category: "Sweets", grams: 900, packCount: 18, unitType: "bags", price: 15.8, emoji: "🍪" }
];

export const seededTrips: Trip[] = [
  {
    id: "t1",
    communityId: "c1",
    runnerId: "u1",
    dayOfWeek: "Saturday",
    scheduledAt: "2026-03-08 10:30",
    pickupLocation: "Downtown Towers Lobby",
    status: "OPEN",
    attachedOrders: [
      {
        id: "o1",
        userId: "u2",
        notes: "Can drop at unit 402 after 4pm",
        lines: [
          { itemId: "i2", claimedUnits: 2 },
          { itemId: "i5", claimedUnits: 4 }
        ]
      },
      {
        id: "o2",
        userId: "u3",
        notes: "Need this for meal prep",
        lines: [
          { itemId: "i8", claimedUnits: 1 },
          { itemId: "i4", claimedUnits: 4 }
        ]
      }
    ]
  },
  {
    id: "t2",
    communityId: "c2",
    runnerId: "u4",
    dayOfWeek: "Sunday",
    scheduledAt: "2026-03-09 13:15",
    pickupLocation: "Campus South Gate",
    status: "OPEN",
    attachedOrders: [
      {
        id: "o3",
        userId: "u1",
        notes: "Text me when you arrive",
        lines: [
          { itemId: "i9", claimedUnits: 6 },
          { itemId: "i6", claimedUnits: 1 }
        ]
      }
    ]
  }
];
