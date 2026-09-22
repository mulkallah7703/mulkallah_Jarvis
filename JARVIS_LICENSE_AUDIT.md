# JARVIS — LICENSE AUDIT

This is **not** a claim that the project is license-free or fully owned by Mulk Allah.

Classifications: OWN CODE | THIRD-PARTY OPEN SOURCE | THIRD-PARTY ASSET | UNKNOWN ORIGIN | REQUIRES ATTRIBUTION | REQUIRES LICENSE REVIEW | SAFE TO KEEP UNDER CURRENT LICENSE TERMS

## Application LICENSE

`LICENSE` is MIT with **two** copyright lines:

- Copyright (c) 2026 Mulk Allah — original JARVIS application code
- Copyright (c) 2026 Ruben Mouradian (Reznikov Engineering) — APEX-UI derived files

Removing the second line would violate MIT for the derived HUD. **KEEP BOTH.**

## npm packages

| Dependency | Version (lock/installed at audit) | License | Used? | Removed? | Attribution | Notes |
|---|---|---|---|---|---|---|
| next | 15.3.8 | MIT | YES | NO | Keep notices in distributions | Framework |
| react | 19.2.8 | MIT | YES | NO | Same | |
| react-dom | 19.2.8 | MIT | YES | NO | Same | |
| three | 0.184.0 | MIT | YES | NO | Same | HolographicHumanoid |
| lucide-react | 0.511.0 | ISC | YES | NO | ISC notice | ChatHud icons |
| @react-three/fiber | 9.7.0 | MIT | NO after cleanup | YES | n/a | Only unused ApexCore3D |
| @react-three/postprocessing | 3.0.5 | MIT | NO after cleanup | YES | n/a | Same |
| typescript | ^5 / 5.9.3 | Apache-2.0 | dev | NO | Apache-2.0 | Tooling |
| eslint | ^9 | MIT | dev | NO | | |
| eslint-config-next | 15.3.3 | MIT | dev | NO | | |
| @types/node | ^20 | MIT | dev | NO | | |
| @types/react | ^19 | MIT | dev | NO | | |
| @types/react-dom | ^19 | MIT | dev | NO | | |
| @types/three | ^0.184.1 | MIT | dev | NO | | |

MIT/ISC: retain copyright and permission notices. Apache-2.0 (TypeScript): retain license, NOTICE if any, state changes if you redistribute modified TS itself (not typical for an app).

Transitive licenses inside `node_modules` are **not fully enumerated**. **REQUIRES LICENSE REVIEW** for a complete SBOM.

## Copied source (not npm)

| Item | Origin | License | Used? | Removed? | Class |
|---|---|---|---|---|---|
| ShaderBackground.jsx | 21st.dev via APEX-UI | MIT per CREDITS.md; exact author URL missing | YES | NO | THIRD-PARTY OPEN SOURCE, REQUIRES ATTRIBUTION, UNKNOWN ORIGIN (author handle) |
| Overview lamp (OverviewPanel.tsx) | 21st.dev via APEX-UI | MIT per CREDITS.md; exact author URL missing | YES | NO | SAME |
| ReasoningWeb.jsx | APEX-UI | MIT LICENSE | YES | NO | THIRD-PARTY OPEN SOURCE, REQUIRES ATTRIBUTION |
| OrbStatusBar.jsx | APEX-UI | MIT | YES | NO | SAME |
| Deleted ApexOrb / ApexHeroOrb / ApexCore3D / apex-orb.css | APEX-UI | MIT | NO | YES (unused) | Removal does not erase git history copyright |
| HolographicHumanoid, ChatHud, chat-server, voice hooks | JARVIS | MIT (Mulk Allah) | YES | NO | OWN CODE |
| Open-Meteo / Gemini / OpenAI | remote APIs | vendor terms | YES | NO | THIRD-PARTY SERVICE — REQUIRES LICENSE REVIEW for commercial use |

## Fonts / images / 3D files

No bundled webfonts, images, or model files in `public/`. SVG `fontFamily` names (“Share Tech Mono”) are CSS fallbacks only.

## Action

SAFE TO KEEP UNDER CURRENT LICENSE TERMS if `LICENSE` + `CREDITS.md` remain. Not “100% owned.”
