# Continuity Studio

Continuity Studio is an AI-filmmaking workspace built around **persistent story continuity**: characters, wardrobe, locations, props, shot state, story rules, and visual history can be managed in one place.

The demo project is **The Message From Tomorrow**, a 12-shot continuity test.

## Current MVP

The prototype now has a live Supabase backend and a no-API Phase 3 generation workflow:

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
- No-API continuity prompt compiler
- Canon Story Bible assets are automatically included in the prompt package
- Previous canon shot frame is included in the reference checklist when available
- Optional director adjustment per shot
- One-click prompt copy and Open ChatGPT workflow
- Generated images can be uploaded back into Visual History, then approved and promoted to canon

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

## Phase 3: no-API workflow

No OpenAI API key, API credits, or paid API account is required for the default workflow.

For a shot:

1. Lock the required Story Bible assets as canon and attach their references.
2. Click **Copy prompt package** in the No-API Generation panel.
3. The app compiles the shot camera, time, action, visual style, canon assets, continuity rules, and previous canon frame context.
4. Click **Open ChatGPT**, attach the references listed by Continuity Studio, paste the copied prompt, and generate one frame.
5. Save the generated image and use **Upload frame** in Continuity Studio.
6. Approve the best result and promote the final frame to canon.

A previously deployed API generation Edge Function remains in the repository as an optional future provider path, but the app does not require or invoke it in the default Phase 3 workflow.

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

Database migrations live in `supabase/migrations/`.

## Next milestone

Improve the manual generation handoff: easier reference export/download, richer prompt previews, and image-to-video workflow while preserving the same shot, asset, canon, and visual-history model.
