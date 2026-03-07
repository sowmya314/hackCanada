# BulkBridge Native App (Expo)

This is a true native mobile app version of BulkBridge.

## What works now

- Mobile-first grocery UI inspired by your reference design
- Working tabs: Shop, Trips, Pantry, Profile
- Working product add buttons
- Working "attach grocery list" to selected trip
- Seeded fake users with pre-attached grocery lists
- Trip completion action (runner side)
- Pantry recipe generation:
  - Uses backend Gemini endpoint if `EXPO_PUBLIC_API_BASE_URL` is set
  - Falls back to local recipe engine if not

## Run

```bash
cd native-app
npm install
npm run start
```

Then open in Expo Go on your phone, or launch iOS/Android simulator from Expo.

## Optional Gemini wiring

Set API base URL in `native-app/.env`:

```bash
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LOCAL_IP:3000
```

Use local IP (not localhost) when testing on a physical device.
