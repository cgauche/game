# Lisibilité du tir + action Viser — Implementation Plan

> Design confirmé (Q&A) : breakdown détaillé + **action Viser (+20)** + portée à l'écran (**overlay de bandes + infobulle au survol**).
> **Source RETROUVÉE** : la table des Difficultés de Combat est dans `14 - _GoBack.md` l.78-120 (artefact OCR). Valeurs **toutes sourcées** désormais :
> Bout portant +60 (l.82), Courte +40 (l.88), Moyenne +0 (l.96), **Longue −10** (l.99), Extrême −30 (l.118) ; **Viser (dernière action) → +20** (l.90, « pas de Test exigé pour viser ») ; Localisation visée −10 (l.104) ; cible À Terre +20 (l.93). → le « flag » tombe ; on **corrige** `rangeBandModifier` (Longue = −10, pas 0).

**Goal:** Rendre lisibles les modificateurs d'un tir, **ajouter l'action Viser (+20 au prochain tir)**, corriger la bande Longue (−10, sourcé), et montrer la portée/bande à l'écran.

**Architecture:** Source unique des modificateurs dans `combat.ts` (`attackModifiers`/`defenseModifiers` → liste étiquetée, utilisée par le moteur POUR sommer ET par l'UI POUR afficher). `RollBreakdown.mods` porte le détail. La modale affiche les chips + la distance ; `IsoStage` peint les bandes concentriques autour du tireur en mode tir + une infobulle de distance au survol.

**Tech:** Vite+TS+React, SVG iso, Vitest.

---

## Task 1 — Moteur : corriger la bande Longue + action Viser + modificateurs étiquetés (source unique)

- **Fix sourcé** `rangeBandModifier` : `≤÷10 →+60`, `≤÷2 →+40`, `≤×1 →0`, `≤×2 →−10` (Longue, l.99 — corrige le 0), `≤×3 →−30`, sinon null. Retirer le « à vérifier » (citer `14 - _GoBack.md` l.82-118).
- `rangeBandName(distTiles, rangeM)` : 'Bout portant'/'Courte portée'/'Moyenne'/'Longue'/'Extrême'/null (mêmes seuils).
- **Action Viser** : `Combatant.aiming?: boolean`. `battleAim()` (héros, `!acted && canTakeAction`, arme à distance équipée) → `aiming=true`, `acted=true`, **pas de jet** (l.90). Le tir ajoute **+20 « Viser »** si `aiming`, puis le consomme. `aiming` est purgé si le héros engage une AUTRE action (mêlée/incantation/objet/recharger/ramasser) sans tirer.
- `ModLine { label; value }` + `RollBreakdown.mods?: ModLine[]`.
- `attackModifiers(attacker, target, weapon, {kind, location?, distanceTiles?})` → `ModLine[]` (non nuls) : Avantage (adv×10), État (combatTestPenalty), [ranged: bande de portée ; melee: Cible vulnérable], **Viser +20 (si aiming, ranged)**, Précise (+10), Localisation visée (−10).
- `defenseModifiers(defender, mode)` → Avantage, État, Sur la défensive (+20).
- `bd(label, base, t, mods?)` stocke `mods` ; moteur somme via `sumMods(...)` (remplace les sommes inline de `resolveRanged`/`rollMeleeAttacker`) → zéro drift. Câbler sur `resolveRanged`, `finishMelee` (atk+def), `resolveMeleePassive`, `rederivePassiveAttack`.
- Tests : `rangeBandModifier` (Longue=−10, Extrême=−30) ; `resolveRanged` à courte portée → mods contient `{Courte portée, +40}` ; un tireur `aiming` → mods contient `{Viser, +20}` ; `battleAim` pose `aiming` sans jet, consommé au tir.

## Task 2 — Modale d'attaque + ActionBar (action Viser)

- `RollLine` : si `mods` présents ET `sum(mods) === modifier`, afficher les chips étiquetés (`+40 Courte portée`, `+20 Viser`…) ; sinon repli sur l'affichage groupé.
- Ligne distance/bande (tir) avant le jet : « Cible à N m — Courte portée (+40) ».
- **ActionBar** : slot **« 🎯 Viser »** (héros, arme à distance équipée, `!aiming`) → `battleAim` ; indicateur « visée » quand `aiming`. (La grille « Localisation visée » reste inchangée — c'est le tir à −10, distinct.)
- CSS chips + slot.

## Task 3 — `IsoStage` : overlay de bandes + infobulle au survol  ✅ FAIT

> Réalisé une fois l'IsoStage parallèle (caméra rotation/zoom) finalisé, en réutilisant sa projection
> rot-aware (`tileFromEvent` partagé clic/survol). En mode attaque + arme à distance active : bandes
> concentriques teintées par `rangeBandModifier` + infobulle « N m · bande (+/−M) » au survol.

- En mode `action==='attack'` avec une arme à distance active : peindre les **bandes concentriques** (Bout portant/Courte/Moyenne/Longue/Extrême) autour du tireur (teintes), via `rangeBandModifier` par case (distance chebyshev).
- **Infobulle au survol** d'une case en mode tir : « N m · `bande` (+/−M) ». Suit le curseur.
- Gating : héros actif, arme à distance, sinon rien (pas d'overlay en mêlée).

## Task 4 — Vérif + commit

- `npm test`, `typecheck`, `build`. Recette navigateur via le scénario **Tir & Rechargement** (Viser → +20, bandes affichées, breakdown lisible).
