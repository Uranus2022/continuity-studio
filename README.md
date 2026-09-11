# Continuity Studio

A prototype workspace for AI filmmaking where characters, locations, props, visual rules, and shot-level continuity can be locked before generation.

## MVP goal

Prove the workflow before paying for generation APIs:

1. Create a film project.
2. Define characters, locations and props.
3. Lock assets as canon.
4. Build shots against inherited continuity rules.
5. Flag conflicts before image/video generation.
6. Later route approved shots to image/video providers.

The included demo project is **The Message From Tomorrow**, based on a 12-shot short-film continuity test.

## Run locally

Requires Node.js 22+.

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Current prototype

- Interactive 12-shot timeline
- Shot inspector
- Story Bible for character/location/props
- Continuity check panel
- Canon / draft / planned shot states
- Mock continuity rules
- Responsive layout

## Next build step

Replace mock data with Supabase tables and CRUD:

- projects
- characters
- locations
- props
- shots
- continuity_rules
- shot_assets
- generations

Then add a provider adapter layer for image/video generation.
