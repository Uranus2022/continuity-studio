# Continuity Studio — MVP architecture

## Product principle

Generation models are replaceable. The durable product is the film state: canon assets, story rules, shot history, approved frames, and continuity checks.

## Core objects

- **Project** — one film / episode.
- **Asset** — character, location, prop, wardrobe or reference image.
- **Shot** — camera + action + time + inherited assets + generation history.
- **Continuity Rule** — a hard or soft constraint that can apply globally or to a shot range.
- **Generation** — one request to an external image/video provider.

## MVP request flow

1. User selects a shot.
2. App loads project canon + shot assets + applicable rules.
3. Continuity engine validates the requested shot state.
4. Prompt composer produces a provider-neutral prompt and reference set.
5. Provider adapter submits the request.
6. Result is saved as a generation candidate.
7. User can mark one result **Lock as Canon**.
8. Future shots inherit that approved state.

## First continuity rules to support

- Character identity must match a canon reference.
- Wardrobe persists until explicitly changed by the script.
- Props have persistent appearance and spatial relationships.
- A prop can enter or leave the story only in defined shot ranges.
- Time-of-day lighting changes must follow scene boundaries.
- Approved frames become references for later shots.

## Deliberately out of scope for Pilot 0

- Training our own foundation model.
- Full non-linear video editor.
- Audio/dialogue generation.
- Multi-user collaboration.
- Automated billing.
