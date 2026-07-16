---
name: game-bestiary-sprite-bar
description: Barre de qualité et méthode validées pour les sprites SVG du bestiaire (creatureSprites.json)
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8d7c3473-adf9-4340-b72d-2fb5f8fd0d73
---

Pour les sprites SVG de créatures (`src/gameIso/creatureSprites.json`, consommés via `enemySprite`/`composeAppearance`), la barre de qualité que l'utilisateur valide = les sprites **dessinés main qu'il aime explicitement : l'Ogre (créature), le Tueur (slayer) et le Soldat** dans `sprites.ts`. Style « toon » cel-shadé : silhouette trapue/lisible, palette juste, visage net (œil via `g_eye`), un accessoire de caractère.

Exigences dures, apprises de la corruption de génération initiale :
- **Anti-BLOB-vert, pas anti-vert** : le travers à proscrire est le *blob informe vert mousse* collé par défaut sur une créature qui ne devrait pas l'être (pigeon vert, humain vert = bug). Le vert EST légitime quand il sert une vraie silhouette : orcs/gobelins/snotlings/hommes-bêtes/trolls/squigs **et les mutants/Chaos** (l'utilisateur l'a confirmé 2026-06-04 : « les mutants ont le droit d'être vert »). Règle = silhouette d'abord ; un mutant vert reptilien bien dessiné est OK, un blob vert ne l'est pas.
- **Silhouette reconnaissable d'abord** : « l'idée qu'on se fait » de la bête (pigeon = oiseau dodu, loup = canidé svelte et bas, dragon = ailé cornu allongé) — surtout pas de blob.
- **Travers récurrents de l'IA à éviter** : pattes en échasses, corps en ballon. Pattes ≈ 1/3 hauteur, corps qui domine.
- Canevas ~120×150, base/pieds à y≈150, centre x≈60, wrapper `<g class="bob">`. Seuls les gradients de `DEFS` existent.

**Méthode qui a marché (juin 2026)** : workflow multi-agents best-of-2 (2 candidats → choix DA strict → retouche), chaque agent lit la planche officielle `art-ref/ldb/` + reçoit desc/traits canon (`src/data/creatures.json`) + une **consigne de silhouette ciselée** (cruciale pour les créatures complexes). ⚠️ Plusieurs créatures **partagent une même planche** (`mapping.json` : Pigeon+Rat+Sanglier, Vampire+Zombie, Loup+Ours…) → toujours dire à l'agent quelle créature extraire et lesquelles ignorer (cause de la corruption d'origine). Le SVG dessiné par IA **plafonne** sur les gros complexes ailés ; viser « icône de jeu stylisée propre », pas de l'illustration. Voir [[game-visual-direction]].
