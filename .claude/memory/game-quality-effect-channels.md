---
name: game-quality-effect-channels
description: Les 3 canaux de mécanique en donnée (passive GameOp / effects TriggeredEffect / capabilities flags) — les caps ne sont PAS du legacy à migrer en GameOp.
metadata: 
  node_type: memory
  type: project
  originSessionId: fc8fbd88-39a7-45b7-a964-32b9d4050814
---

Question récurrente de l'user (« on a tout passé en GameOp, pourquoi des flags qui traînent ? »). Réponse **vérifiée par les déclarations de champs** (pas les commentaires) : une entité mécanique (`QualityData`, `TalentData`, `TraitData`, `EtatData`, `PsychologyData`, `Mutation`) porte sa mécanique sur **TROIS canaux data-driven**, cohérents sur toutes les tables :

1. **`passive: GameOp[]`** — modificateurs de VALEUR appliqués à une cible/stat (`weaponRollMod`, `weaponDamageMod`, `charMod`, `ap`, `testMod`…). Exécutés par `applyOps(target, ops)`. Ex. Imprécise = `weaponRollMod -1 DR`.
2. **`effects: TriggeredEffect[]`** — effets DÉCLENCHÉS sur un événement, via `fireTriggers`.
3. **`capabilities` / `combat: CombatFeature`** — **drapeaux IRRÉDUCTIBLES** : prédicats de branche de règle / propriétés lus par des dispatchers GÉNÉRIQUES qui ne nomment aucune entité. Ex. `fumbleOn9` (Dangereuse, lu par `dangerousNine`), `crewedTeam`, `fastStrike`, `psychImmune` (`isPsychImmune`), `EtatData.recover`/`stacksReducedBy`.

**La « langue unique GameOp » régit l'axe EFFET/MODIFICATEUR seulement** (cf. CLAUDE.md : « GameOp = effet exécuté par `applyOps(target,…)` »). Un cap comme `fumbleOn9` n'a **aucune cible** : ce n'est pas un effet appliqué, c'est une propriété que la règle consulte → le forcer en GameOp = inventer un op que seul son dispatcher lirait (zéro unification, et ça désalignerait Talents/États/Psycho qui gardent ce canal). La migration « code → donnée » a remplacé les `combatFeatures/defs/*.ts` (handlers par-nom) par des **flags typés**, PAS par des GameOps.

**Conséquence pratique** : pour injecter des Défauts d'arme (ex. sous-effectif Arme d'équipe), injecter les **ids de qualité** (`imprecise`/`dangereuse`) → chaque Défaut emporte son canal natif (GameOp pour Imprécise, cap pour Dangereuse), sans choisir de représentation. Cf. [[game-naval-tactical-chantier]] (`crewedFireWeapon`).
