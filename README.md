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
- **Google Cloud Vision** (OCR) + **Google Cloud Storage** + **sharp** for the photo-scan importer

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

   For **importing a recipe by photo (OCR)**, set `GOOGLE_VISION_API_KEY`, `GCS_BUCKET`,
   and `GCS_SA_KEY` — see [Importing by photo (OCR)](#importing-by-photo-ocr) for how to
   create them. Without them, the scan importer degrades gracefully (a clear
   "not configured" message; everything else keeps working).

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
- `npm run check:gcs` — upload a 1×1 test image to verify `GCS_BUCKET` + `GCS_SA_KEY` work
- `npm run build` / `npm start` — production build & serve

## How importing works

`POST /api/import` fetches the target page and parses the first
`<script type="application/ld+json">` block matching schema.org `Recipe` (handling
`@graph`, arrays, `HowToStep`/`HowToSection`, ISO-8601 durations, etc.). If no structured
data is found it falls back to OpenGraph metadata so you can finish the recipe by hand.
Nothing is saved until you review and submit.

## Importing by photo (OCR)

**Import → 📷 Scan a photo** lets you turn a photo of a cookbook page or recipe card into a
recipe. Upload/snap a photo, draw boxes around the **title**, **ingredients**, **directions**,
and (optionally) the **image**; the text is read with **Google Cloud Vision**, and the box you
mark as *Image* is cropped and stored in **Google Cloud Storage**. The result prefills the
normal recipe form for review before saving. The full scan is OCR'd inline and never stored —
only the cropped image is uploaded.

This needs three environment variables, all created in the **same Google Cloud project** as
your Translation key.

### `GOOGLE_VISION_API_KEY`

1. Console → **APIs & Services → Library** → search **Cloud Vision API** → **Enable**.
2. **APIs & Services → Credentials → + Create credentials → API key**. Copy the key.
   (You can reuse your Translate key's value here as long as the Vision API is enabled on
   that project.)

### `GCS_BUCKET` — create a bucket (the value is the bucket name)

1. Console → **☰ → Cloud Storage → Buckets → + Create**
   (<https://console.cloud.google.com/storage/browser>).
2. **Name** it something globally-unique, e.g. `recipe-manager-scans-<you>` → that string is
   your `GCS_BUCKET` (just the name, **not** a URL).
3. **Location**: a Region near you (e.g. `europe-west4`). Storage class: Standard.
4. **Access control**: choose **Uniform**.
5. **Public access prevention**: turn **off** (the cropped images must be publicly viewable).
6. Create.
7. Open the bucket → **Permissions → + Grant access** → principal `allUsers`, role
   **Storage Object Viewer** → Save → allow public access.

### `GCS_SA_KEY` — a service-account key, base64-encoded

1. Console → **☰ → IAM & Admin → Service Accounts → + Create service account**
   (<https://console.cloud.google.com/iam-admin/serviceaccounts>). Name e.g. `recipe-uploader`.
2. Grant it the **Storage Object Admin** role (project-wide, or scoped to just the bucket via
   the bucket's **Permissions** tab).
3. Open the service account → **Keys → Add key → Create new key → JSON**. A `.json` file
   downloads.
4. Base64-encode the whole file into a single line and copy it (macOS):
   ```bash
   base64 -i ~/Downloads/recipe-uploader-*.json | tr -d '\n' | pbcopy
   ```
   Paste the result as `GCS_SA_KEY`. (We base64 the entire file because the `private_key`
   inside it contains newlines that don't survive a raw paste into an env var.)

### Where the values go

- **Local**: add all three to `.env`.
- **Vercel**: Project → **Settings → Environment Variables** → add all three for Production +
  Preview, then redeploy.

**Sanity check:** `GCS_BUCKET` is a short name; `GCS_SA_KEY` is a long single-line base64
blob that decodes to JSON containing `"type": "service_account"`. If granting `allUsers`
access is blocked, your account has a public-access org policy (common on work accounts, not
on personal projects).

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
