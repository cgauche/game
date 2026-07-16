---
name: env-npm-lock-regen-npm10-ci
description: package-lock régénéré avec le npm 11 local casse npm ci en CI (npm 10) — régénérer via npx npm@10
metadata: 
  node_type: memory
  type: project
  originSessionId: b01212b8-6728-41cc-b726-ae207da81ef1
---

La CI (GitHub Actions, `node-version: '22'` → npm **10.x** embarqué) a été rouge du 2026-07-15 au
2026-07-16 sur `npm ci` : `Missing: @emnapi/core@1.11.2 from lock file`. Cause : le lock avait été
régénéré en local avec **npm 11.6.1**, qui ne matérialise pas les `peerDependencies` de
`@napi-rs/wasm-runtime` (paquet dev optionnel) — npm 10 exige les entrées hoistées
`node_modules/@emnapi/core` + `runtime`.

**Why:** npm 10 et npm 11 produisent des locks structurellement différents (flags `peer`,
matérialisation des peers d'optionnels) ; un lock « propre » pour l'un est invalide pour l'autre.
La suite locale (typecheck + vitest) ne voit RIEN — seul `npm ci` froid le révèle.

**How to apply:** toute régénération du lock se fait avec le npm de la CI :
`npx --yes npm@10.9.3 install --package-lock-only`, puis valider `npx npm@10.9.3 ci --dry-run`
(exit code, pas le grep). Fix livré : `cd93b1b6`. Si la CI passe un jour à node 24+, réaligner la
version dans cette fiche. Voir [[game-rtk-gitshow-tsbuildinfo-phantom-errors]] pour les autres
fausses-catastrophes d'outillage.
