# JARVIS — CLEANUP AUDIT

Written **before** destructive changes. Source of truth: current tree + `JARVIS_CURRENT_STATE.md`.

**Git status at audit start:**

```
 M lib/chat-server.ts
?? .eslintrc.json
?? JARVIS_CURRENT_STATE.md
```

No commit/push will be made by this cleanup.

---

## 1. What is live vs unused

| File | Live? | Evidence | Planned action |
|---|---|---|---|
| `app/page.tsx` | YES | only page | Branding + import names |
| `app/layout.tsx` | YES | root layout | Metadata |
| `app/globals.css` | YES | layout import | Rename `.apex-overview` class |
| `app/api/chat/route.ts` | YES | ChatHud fetch | Keep |
| `app/api/weather/route.ts` | YES | Overview Clock | Keep |
| `lib/chat-server.ts` | YES | chat route | Keep (Gemini/OpenAI) |
| `components/ApexWorld.tsx` | YES | page.tsx | Rebrand; extract OrbState import |
| `components/ApexOverviewPanel.tsx` | YES | page.tsx | Remove Reznikov socials; keep clock/weather |
| `components/ChatHud.tsx` | YES | ApexWorld | OrbState import path |
| `components/HolographicHumanoid.tsx` | YES | dynamic import | Comment cleanup only |
| `components/ShaderBackground.jsx` | YES | ApexWorld | Keep; MIT 21st.dev — attribution required |
| `components/ReasoningWeb.jsx` | YES | ApexWorld | Keep visual; strip Apex copy |
| `components/OrbStatusBar.jsx` | YES | ApexWorld | Hint copy |
| `components/useSpeechInput.ts` | YES | ChatHud | Keep |
| `components/useMicEnergy.ts` | YES | ApexWorld | Keep |
| `components/ApexHeroOrb.tsx` | NO (type only) | `import type { OrbState }` | Delete after extracting type |
| `components/ApexOrb.jsx` | NO | only ApexHeroOrb | Delete |
| `components/ApexCore3D.jsx` | NO | only ApexHeroOrb | Delete |
| `components/apex-orb.css` | NO | only ApexHeroOrb | Delete |
| `LICENSE` | YES | legal | Dual copyright: keep original MIT notice + add Mulk Allah |
| `CREDITS.md` | YES | attribution | Keep 21st.dev/APEX-UI credit; JARVIS framing |
| `README.md` | YES | docs | JARVIS identity + required credits |

**Do not delete:** hologram, chat, voice, `/api/chat`, `/api/weather`, shader, reasoning web visual, status bar, Next config.

---

## 2. Previous branding (visible / metadata)

| Location | Content | Action |
|---|---|---|
| `ApexOverviewPanel.tsx` TILES | Reznikov Instagram/Facebook/LinkedIn | Remove |
| `app/page.tsx` | Badge “Mulkallah Jarvis” | JARVIS |
| `app/layout.tsx` | Title/description mention APEX-UI | JARVIS tagline |
| `package.json` description | “APEX-UI base” | JARVIS description |
| `README.md` | APEX as product, Astra reel | JARVIS product + credit APEX-UI as origin |
| `ApexWorld.tsx` | “Apex agents”, “Apex routes work”, fake specialists | Honest JARVIS constellation copy |
| `ReasoningWeb.jsx` | aria-label “Apex reasoning web”, core label “Apex” | JARVIS |
| `OrbStatusBar.jsx` | “CLICK AN AGENT” / Apex comments | JARVIS-oriented hint |
| `LICENSE` | Only Ruben Mouradian | Keep + add Mulk Allah (MIT fork) |

---

## 3. License snapshot (pre-cleanup)

See also `JARVIS_LICENSE_AUDIT.md` (written after cleanup).

| Dependency | Version (installed) | License | Used by app? | Action |
|---|---|---|---|---|
| next | 15.3.8 | MIT | YES | KEEP |
| react | 19.2.8 | MIT | YES | KEEP |
| react-dom | 19.2.8 | MIT | YES | KEEP |
| three | 0.184.0 | MIT | YES (`HolographicHumanoid`) | KEEP |
| lucide-react | 0.511.0 | ISC | YES (`ChatHud`; overview after social removal still ChatHud) | KEEP |
| @react-three/fiber | 9.7.0 | MIT | NO (only ApexCore3D) | REMOVE |
| @react-three/postprocessing | 3.0.5 | MIT | NO | REMOVE |
| typescript | 5.9.3 | Apache-2.0 | dev | KEEP |
| eslint | 9.39.5 | MIT | dev | KEEP |
| eslint-config-next | 15.3.3 | MIT | dev | KEEP |
| @types/* | various | MIT | dev | KEEP |

MIT/ISC/Apache obligations: retain copyright notices; Apache-2.0 also NOTICE if present (TypeScript ships Apache-2.0).

**Copied UI (not npm):**

| Asset | Origin | License | Classification |
|---|---|---|---|
| `ShaderBackground.jsx` | 21st.dev community component via APEX-UI | MIT (CREDITS.md); exact 21st.dev author URL missing | THIRD-PARTY OPEN SOURCE — REQUIRES ATTRIBUTION — exact author UNKNOWN |
| Overview lamp (in ApexOverviewPanel) | 21st.dev via APEX-UI | MIT (CREDITS.md); exact author URL missing | SAME |
| ReasoningWeb, OrbStatusBar, Apex* orb files | APEX-UI (Ruben Mouradian / Reznikov Engineering) | MIT `LICENSE` | THIRD-PARTY OPEN SOURCE — REQUIRES ATTRIBUTION |
| `HolographicHumanoid.tsx`, ChatHud, chat-server | JARVIS additions | to be dual-copyright MIT | OWN CODE (application) |
| Open-Meteo API | used at runtime | their terms; no package | THIRD-PARTY SERVICE |
| Gemini / OpenAI APIs | runtime | vendor terms | THIRD-PARTY SERVICE |

**UNKNOWN ORIGIN — MANUAL REVIEW REQUIRED:** exact 21st.dev component URLs/authors (placeholders in CREDITS.md). Shader and overview lamp remain attributed to 21st.dev MIT generally.

No images, 3D model files, or webfonts in `public/` (folder absent). “Share Tech Mono” / “Inter” named in SVG `fontFamily` only — fallback to generic monospace; not bundled.

---

## 4. Dependencies to remove

`@react-three/fiber`, `@react-three/postprocessing` — only imported by unused `ApexCore3D.jsx`. After deleting that file, uninstall. Do not upgrade remaining packages.

---

## 5. Security (pre-check)

- `.gitignore` has `.env*.local`
- Keys only in `lib/chat-server.ts` via `process.env`
- No `NEXT_PUBLIC_*` secrets
- Do not print values

---

## 6. Cleanup plan (non-destructive to product loop)

1. Add `components/orb-state.ts` with `OrbState`.
2. Delete unused orb stack.
3. Strip Reznikov social tiles.
4. Replace visible Apex product claims with JARVIS identity; keep constellation as **decorative HUD** (not a live multi-agent OS).
5. Dual-copyright LICENSE; keep CREDITS.
6. Docs: architecture, license audit, removed-legacy.
7. `npm install` → build, tsc, lint.

**Out of scope:** hologram rewrite, chat/voice/Gemini architecture, wake word, auth, dependency upgrades.
