# Continuity Studio

Continuity Studio is an AI-filmmaking workspace built around **persistent story continuity**: characters, wardrobe, locations, props, shot state, and story rules can be locked before image/video generation.

The demo project is **The Message From Tomorrow**, a 12-shot continuity test.

## Current MVP

The prototype now has a live Supabase backend:

- Email/password authentication
- Per-user projects protected with Row Level Security
- Persistent projects and shots
- Character, location, wardrobe, and prop assets
- Shot-to-asset relationships
- Continuity rules
- Canon / draft / planned states
- Working **Lock as Canon** persistence
- Automatic bootstrap of the 12-shot demo project after first sign-in
- Provider interface ready for future image/video generation APIs

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

## Supabase

The live MVP database includes:

- `projects`
- `assets`
- `shots`
- `shot_assets`
- `continuity_rules`
- `generations`

RLS is enabled on all user-owned application tables.

The browser app uses only the Supabase **publishable** key. Never put a Supabase service-role key or another server secret in client-side code or in GitHub.

A reproducible database definition lives in `supabase/schema.sql`.

## Next product milestone

Move from persistence to generation workflow:

1. Upload/reference canonical character and location images.
2. Add a continuity-aware prompt compiler.
3. Add pre-generation continuity validation.
4. Connect the first image/video provider.
5. Store generations and promote an approved output to canon.
6. Add a timeline/export workflow.
