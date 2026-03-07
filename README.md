# BulkBridge

BulkBridge is a hackathon full-stack app for organizing Costco trips inside local communities and splitting bulk items fairly.

## Features

- Authentication (register/login/logout)
- Community system with distance-based browsing, create community, and join/set active community
- Costco trip creation by day of week + pickup location/date
- Trip cards showing:
  - runner name
  - completed trips count
  - rating (average)
  - number of attached orders
- Order attachment to trips with multipack unit claims (example: 3-pack bread -> claim 1 loaf)
- Incentive system where runners earn simulated Costco store credit when trips are completed
- AI pantry assistant:
  - speech-to-text in browser
  - Gemini-powered pantry extraction and recipe suggestions
  - fallback heuristic mode if `GEMINI_API_KEY` is not set
- Costco grocery dataset ingestion from `costco_bulk_grocery_dataset_900_items.csv`

## Stack

- Next.js (App Router + API routes)
- Prisma + SQLite
- JWT cookie auth
- Gemini API (optional)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

3. Initialize database schema:

```bash
npx prisma db push
```

4. Seed Costco items + starter communities:

```bash
npm run db:seed
```

5. Start development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Highlights

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET|POST|PUT /api/communities`
- `GET|POST /api/trips`
- `POST /api/trips/:id/orders`
- `POST /api/trips/:id/complete`
- `GET /api/items?q=...`
- `POST /api/pantry/analyze`

## Notes

- Speech capture uses `SpeechRecognition`/`webkitSpeechRecognition` in supported browsers.
- Pantry assistant calls Gemini when `GEMINI_API_KEY` is configured.
