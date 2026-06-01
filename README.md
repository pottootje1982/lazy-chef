# 🍳 Recipe Manager

A web app to store your recipes and import them from the web (e.g. BBC Good Food) by
parsing schema.org/Recipe structured data. Personal accounts via Google sign-in **or
email & password**; each user has their own private collection. Ingredients can be linked
to real products from **Picnic** (the Dutch online grocer), with automatic EN→NL
translation.

## Stack

- **Next.js 15** (App Router, TypeScript) — UI + server actions + API routes
- **PostgreSQL** + **Prisma ORM**
- **Auth.js (NextAuth v5)** with Google OAuth + email/password (Credentials, bcrypt-hashed, JWT sessions)
- **Tailwind CSS**
- **cheerio** for scraping JSON-LD recipe data
- **picnic-api** for grocery product search; **Google Cloud Translation** for EN→NL

## Setup

Requires **Node ≥ 18.18** (an `.nvmrc` pins 22.17.1 — run `nvm use`).

1. **Start Postgres** (Docker):
   ```bash
   docker compose up -d
   ```

2. **Configure environment** — copy the example and fill in values:
   ```bash
   cp .env.example .env
   npx auth secret            # writes AUTH_SECRET (or set it manually)
   ```
   `AUTH_SECRET` is required. Email/password sign-in works with no further config.
   Google sign-in is **optional** — to enable it, create OAuth credentials at
   <https://console.cloud.google.com/apis/credentials> (OAuth client → Web application),
   add redirect URI `http://localhost:3000/api/auth/callback/google`, and put the client
   id/secret into `.env` as `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

   For **ingredient → Picnic product** linking, also set:
   - `PICNIC_ENC_KEY` — `openssl rand -base64 32` (encrypts each user's Picnic key at rest)
   - `GOOGLE_TRANSLATE_API_KEY` — a Google Cloud key with the *Cloud Translation API*
     enabled (used to translate ingredients EN→NL). Without it, the original English
     term is used as the search query.

3. **Install & sync the database schema**:
   ```bash
   npm install
   npm run db:push
   ```

4. **Run**:
   ```bash
   npm run dev
   ```
   Open <http://localhost:3000>.

## Scripts

- `npm run dev` — start the dev server
- `npm run db:push` — push the Prisma schema to the database
- `npm run db:studio` — browse data in Prisma Studio
- `npm run build` / `npm start` — production build & serve

## How importing works

`POST /api/import` fetches the target page and parses the first
`<script type="application/ld+json">` block matching schema.org `Recipe` (handling
`@graph`, arrays, `HowToStep`/`HowToSection`, ISO-8601 durations, etc.). If no structured
data is found it falls back to OpenGraph metadata so you can finish the recipe by hand.
Nothing is saved until you review and submit.

## Linking ingredients to Picnic products

1. Go to **Settings** and connect your Picnic account (email + password; an SMS 2FA code
   is handled in-app). Only the resulting access key is stored, AES-256-GCM encrypted —
   never your password.
2. On a recipe, click **Link product** next to an ingredient. The app normalizes the line
   (strips quantities/units/prep), translates the core term to Dutch, searches Picnic, and
   shows matching products with image, pack size, and price.
3. Pick one — the mapping is saved per-user and keyed by the normalized ingredient, so the
   same ingredient is auto-linked across all your recipes. Use **Change** or **Unlink** any
   time.

Tables: `ProductMapping` (the ingredient→product links) and `Translation` (a shared EN→NL
cache). The Picnic auth key lives encrypted on the `User` row.
