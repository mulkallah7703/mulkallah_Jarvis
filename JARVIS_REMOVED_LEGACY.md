# JARVIS — REMOVED LEGACY

Record of cleanup. Git history still contains deleted files; history was not rewritten.

## Files removed

| File | Reason |
|---|---|
| `components/ApexHeroOrb.tsx` | Unused renderer; only `OrbState` type was imported |
| `components/ApexOrb.jsx` | Only used by ApexHeroOrb |
| `components/ApexCore3D.jsx` | Only used by ApexHeroOrb |
| `components/apex-orb.css` | Only imported by ApexHeroOrb |
| `components/ApexWorld.tsx` | Replaced by `JarvisWorld.tsx` (same stage, JARVIS copy) |
| `components/ApexOverviewPanel.tsx` | Replaced by `OverviewPanel.tsx` without Reznikov social tiles |

## Files added (replacements / types)

| File | Reason |
|---|---|
| `components/orb-state.ts` | Shared `OrbState` type |
| `components/JarvisWorld.tsx` | Live stage |
| `components/OverviewPanel.tsx` | Clock/weather lamp without third-party socials |

## Branding removed (visible / metadata)

- Reznikov Instagram / Facebook / LinkedIn tiles
- On-screen “Mulkallah Jarvis” badge → **JARVIS**
- “Apex agents” / “Apex routes work” / fake live-specialist claims
- Status hint “CLICK AN AGENT”
- Layout/README/package descriptions presenting APEX as the product
- LICENSE now **adds** Mulk Allah copyright; **keeps** Ruben Mouradian (required)

## Dependencies removed

- `@react-three/fiber`
- `@react-three/postprocessing`

## Not removed (still required or still live)

- ReasoningWeb visual constellation (APEX-UI MIT)
- ShaderBackground (21st.dev MIT)
- Overview lamp visual
- Hologram, chat, voice, APIs
- CREDITS.md / original MIT copyright

## Git history note

Portrait PNG / JarvisHologram were already deleted in PR #4 before this cleanup. Secrets may still exist in chat logs or old env files; `.env.local` is gitignored. Full secret scan of all historical blobs was **not** performed.
