# Continuity Studio

Continuity Studio is an AI-filmmaking workspace built around **persistent story continuity**: characters, wardrobe, locations, props, shot state, story rules, visual history, and video takes can be managed in one place.

The demo project is **The Message From Tomorrow**, a 12-shot continuity test.

## Current MVP

The prototype now has a live Supabase backend plus no-API frame and video workflows:

- Email/password authentication
- Per-user projects protected with Row Level Security
- Persistent projects and shots
- Character, location, wardrobe, and prop assets
- Private canon reference storage
- Shot-to-asset relationships
- Continuity rules
- Shot frame visual history
- Frame approval and canon promotion
- Automatic frame state sync: planned → draft → approved → canon
- No-API frame prompt compiler
- Previous canon shot frame context when available
- Private video-take storage
- No-API video prompt compiler built from the current canon frame
- Previous canon video context when available
- Video take upload, preview, approve, canon, and delete actions
- One canon video take per shot

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

## Phase 3: no-API frame workflow

No OpenAI API key, API credits, or paid API account is required for the default frame workflow.

For a shot:

1. Lock the required Story Bible assets as canon and attach their references.
2. Click **Copy prompt package** in the No-API Generation panel.
3. The app compiles camera, time, action, visual style, canon assets, continuity rules, and previous canon frame context.
4. Generate the image in ChatGPT or another image tool you already use.
5. Save it and use **Upload frame** in Continuity Studio.
6. Approve the best result and promote the final frame to canon.

## Phase 4: no-API video workflow

Video work also requires no API key.

1. Make the final frame for the current shot canon.
2. Choose duration, motion intensity, camera movement, and an optional director adjustment.
3. Click **Copy video prompt package**.
4. Generate the clip in any video tool you already use, using the shot's canon frame as the primary source.
5. Upload the MP4, MOV, or WebM file with **Upload video take**.
6. Preview the take inside Continuity Studio.
7. Approve the best take and promote the final one to video canon.
8. Later shots automatically detect the nearest earlier canon video and include it as continuity context.

The MVP accepts video files up to 50 MB and stores them in a private `shot-videos` Supabase Storage bucket.

## Supabase

The live MVP database includes:

- `projects`
- `assets`
- `shots`
- `shot_assets`
- `continuity_rules`
- `shot_frames`
- `shot_video_takes`
- `generations`

RLS is enabled on all user-owned application tables. Canon references, shot frames, and shot videos are stored in private buckets.

The browser app uses only the Supabase publishable key. Never put a Supabase service-role key, OpenAI API key, or another server secret in client-side code or GitHub.

Database migrations live in `supabase/migrations/`.

## Build validation

GitHub Actions runs `npm install` and `npm run build` on pushes to `main` so UI and TypeScript integration errors are caught before local testing.
