---
name: feedback-attribution-rouge-suite-sonde-arbre-committe
description: "Attribuer un rouge de suite exige une sonde sur ARBRE COMMITTÉ (git log -S / git archive), jamais « vert en isolation + WIP étranger présent »"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 95f8c967-e150-40d7-aa35-90f866e88a3a
  modified: 2026-08-07T09:10:31.669Z
---

Vécu 2026-08-07 (#1135, fermeture RÉFUTÉE par le juge) : j'ai attribué DEUX rouges de la suite
complète au WIP non commité de la session parallèle — `vi-mock-isolate-guard` et `set-scan-guard`
(294→297) — sur la foi de « ils passent en isolation » + « l'arbre porte du WIP étranger ». Les deux
venaient de NOS commits : les `vi.mock` de `CombatBanner.test.tsx` (9bae13b3) et les
`hoverDelta: null` de la résolution de déplacement (30614b3b). Le juge l'a prouvé en 10 minutes :
`git log -S` sur le symbole, et le compteur de la garde rejoué sur `git archive <rev>` extrait en
temp (baseline franchie À l'arbre committé propre, PAS par le working tree).

**Pourquoi :** « vert en isolation » ne discrimine RIEN pour une garde à liaison d'ordre
(`vi.mock` + `isolate:false` → [[game-vi-mock-isolate-false-liaison-ordre]]) ni pour un cliquet
agrégé (le compte est le même en isolation). Et « du WIP étranger existe » est un biais de
disponibilité, pas une preuve — deux sondes qui partagent le même angle mort se confirment
mutuellement ([[feedback-mes-propres-sondes-se-remesurent]]).

**Comment appliquer :** tout rouge de suite qu'on veut attribuer à « pas moi » reçoit UNE sonde
discriminante sur l'ÉTAT COMMITTÉ : `git log -S '<symbole>' -- <fichier>` pour dater l'introduction,
ou rejouer le détecteur de la garde sur `git archive <rev>` extrait (le juge a fait les deux).
« Standalone vert » n'est recevable que pour un échec d'environnement (ENOENT d'un fichier d'une
autre session, flake réseau) — jamais pour un cliquet ni une garde d'ordre.

Corollaire re-vécu la même session (2×) : un gate lu À TRAVERS UN PIPE ment — `npm run docs:check
| tail` et le hook RTK ont rendu exit 0 sur une chaîne arrêtée en erreur
([[env-exit-code-avale-par-l-outillage-shell]]) ; la sortie TEXTE fait foi, ou spawnSync.
