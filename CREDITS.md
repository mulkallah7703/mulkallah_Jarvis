# Credits

JARVIS includes third-party and supplied visual material. This file must be kept.
This is **not** a claim that every pixel is owned by Mulk Allah.

## Live frontend (after hologram replacement)

- Particle portrait renderer: `components/ParticleHologram.tsx`, adapted from
  `particle_hologram.html` (Canvas 2D particle sampling). Algorithm preserved.
- Portrait image: `public/jarvis-portrait.png`, extracted from the same HTML
  `IMAGE_DATA` PNG. **Do not substitute a different face.**
- Chat HUD, speech hooks: existing JARVIS client logic (`ChatHud`, `useSpeechInput`).

**UNKNOWN ORIGIN — MANUAL REVIEW REQUIRED:** authorship/license of
`particle_hologram.html` and the embedded portrait were not established beyond
being supplied as the project visual source.

## Previously shipped HUD (removed from the live UI)

The following are no longer imported. Git history still contains them.
Copyright for APEX-UI / 21st.dev MIT material remains in `LICENSE`.

- 21st.dev shader / overview lamp (exact author URLs were never recorded)
- APEX-UI constellation (`ReasoningWeb.jsx`) and orb status chrome
- Procedural Three.js bust (`HolographicHumanoid.tsx`)

Source index for the former 21st.dev pieces:
[21st.dev community components](https://21st.dev/community/components)

APEX-UI: [RubenM1990/APEX-UI](https://github.com/RubenM1990/APEX-UI)
by Ruben Mouradian (Reznikov Engineering), MIT.
