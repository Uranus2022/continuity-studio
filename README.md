# Continuity Studio

Continuity Studio is an AI-filmmaking workspace built around **persistent story continuity**: characters, wardrobe, locations, props, shot state, story rules, visual history, and AI-generated frames can be managed in one place.

The demo project is **The Message From Tomorrow**, a 12-shot continuity test.

## Current MVP

The prototype now has a live Supabase backend and Phase 3 image generation:

- Email/password authentication
- Per-user projects protected with Row Level Security
- Persistent projects and shots
- Character, location, wardrobe, and prop assets
- Private canon reference storage
- Shot-to-asset relationships
- Continuity rules
- Shot visual history
- Frame approval and canon promotion
- Automatic shot state sync: planned → draft → approved → canon
- AI frame generation through a private Supabase Edge Function
- Canon asset references are automatically sent with generation requests
- Previous canon shot frame is inherited when available
- Generated images are stored directly in the shot's Visual History
- Generation records are stored in `generations`

## Run locally

Requires Node.js 22+.

If you already cloned the project:

```bash
git pull
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

On first use, create an account in the app. If Supabase asks for email confirmation, confirm the email once and then sign in. The demo project is created automatically for that authenticated user.

## Phase 3 provider setup

The deployed `generate-shot-image` Edge Function uses OpenAI GPT-Image-2.5 Flare.

The OpenAI API key is deliberately **not** stored in GitHub or browser code. Add it to the Supabase project's Edge Function secrets as:

```text
OPENAI_API_KEY
```

Do not prefix it with `NEXT_PUBLIC_` and do not put it in client-side code.

Once the secret exists, the **Generate continuity frame** panel can create a new frame using the selected shot's canon Story Bible references and the previous canon shot frame when available.

## Supabase

The live MVP database includes:

- `projects`
- `assets`
- `shots`
- `shot_assets`
- `continuity_rules`
- `shot_frames`
- `generations`

RLS is enabled on all user-owned application tables. Storage buckets for canon references and shot frames are private.

The browser app uses only the Supabase publishable key. Never put a Supabase service-role key, OpenAI API key, or another server secret in client-side code or GitHub.

Database migrations live in `supabase/migrations/`, and the deployed Edge Function source lives in `supabase/functions/generate-shot-image/`.

## Next milestone

Phase 3 currently generates still frames. The next provider milestone is image-to-video generation while preserving the same shot, asset, canon, and generation history model.
