import { costcoProducts } from "./costco-products";

export type FakeUser = {
  id: string;
  name: string;
  rating: number;
  completedTrips: number;
  bio?: string;
  homeLat: number;
  homeLng: number;
};

export type GroceryItem = {
  id: string;
  name: string;
  category: string;
  packCount: number;
  unitType: string;
  unitPriceCad: number;
  packPriceCad: number;
  pricingNote: string;
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
  { id: "u1", name: "Maya", rating: 4.9, completedTrips: 21, bio: "Bulk split organizer, always on time.", homeLat: 43.4643, homeLng: -80.5204 },
  { id: "u2", name: "Jordan", rating: 4.7, completedTrips: 14, bio: "Prefers weekend Costco runs.", homeLat: 43.4701, homeLng: -80.5362 },
  { id: "u3", name: "Arjun", rating: 4.8, completedTrips: 17, bio: "Meal prep heavy orders.", homeLat: 43.4554, homeLng: -80.4982 },
  { id: "u4", name: "Nina", rating: 4.6, completedTrips: 10, bio: "Campus route specialist.", homeLat: 43.4728, homeLng: -80.5449 }
];

export const groceryItems: GroceryItem[] = costcoProducts;

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
          { itemId: "csv_1", claimedUnits: 2 },
          { itemId: "csv_2", claimedUnits: 4 }
        ]
      },
      {
        id: "o2",
        userId: "u3",
        notes: "Need this for meal prep",
        lines: [
          { itemId: "csv_3", claimedUnits: 1 },
          { itemId: "csv_4", claimedUnits: 4 }
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
          { itemId: "csv_5", claimedUnits: 6 },
          { itemId: "csv_6", claimedUnits: 1 }
        ]
      }
    ]
  }
];
