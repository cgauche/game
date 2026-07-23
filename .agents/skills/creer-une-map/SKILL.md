---
name: creer-une-map
description: À utiliser quand on crée ou modifie une carte, une scène, un bâtiment, un étage ou un extérieur (tuiles, murs, portes, props, points d'entrée), ou avant de toucher src/scenes/ ou l'authoring ASCII. Aussi pour agrandir/retailler une scène existante.
---
<!-- GENERATED: agents:sync; source=.claude/skills/creer-une-map/SKILL.md -->

# Créer une map / une scène

Lire **`docs/map-authoring.md`** — MapSpec/buildScene est le SEUL chemin d'authoring (jamais poser
les tuiles une à une ; étendre une primitive + golden si le vocabulaire manque). Cartes ASCII :
`src/state/asciiMap.ts` (`parseAsciiRows`/`parseWalledAscii`). Le résultat reste éditable dans
l'éditeur (règle stricte 2 : tout le contenu de campagne est éditable, rien en dur).
