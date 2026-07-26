---
name: game-qualities-registry
description: "Qualités d'objet 100% data-driven : QualityInstance{id,value} + qualities.json (passive GameOp[]/capabilities/effects) lus PAR ID via qualityById — le registre defs/ et le keying par libellé ont disparu (vérifié au code 2026-07-05)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 9b213e55-2ab5-4d6a-98a0-acb9ee46e318
---

Les objets portent des `QualityInstance{id, value?}` STRUCTURÉES (jamais une chaîne « id value » reparsée) ; toute la MÉCANIQUE vit dans **`src/data/qualities.json`** (`passive: GameOp[]` — `weaponRollMod`/`weaponDamageMod`/`armourPierce`/`critOnRoll`/`testMod` — + `capabilities` + `effects`), lue **PAR ID** via `qualityById` (`src/data`). Le registre ne porte AUCUN champ d'effet : `src/engine/qualities/types.ts::QualityDef` se réduit à `{ key }` (le libellé FR canonique) et `src/engine/qualities/registry.ts::QUALITIES` en DÉRIVE 1:1 de la donnée. **Aucun `attackMod`/`armourReduction`/`damageDR` ne se pose dans le registre, et aucun dossier `src/engine/qualities/defs/` ne se recrée** : une qualité s'ajoute dans `qualities.json`, point. Le label ne sert qu'à l'AFFICHAGE, jamais à la résolution mécanique (qui passe uniquement par l'id).

- `dispatch.ts` — helpers PURS (`resolveQualities`, `hasQuality(w,id)`, `isAtoutQuality(id)`, `qualityIndice`, `qualitySum`, `qualityCritTriggered`, `parryDRAdjust`, `canFireWhileEngaged`, `isUnbreakable`, `craftTestDRAdjust`, `qualitySocMod`, `crewedTeamIndice`, `reloadDRTarget`, `rapideParryMod`, `dangerousNine`, `magazineSize`, `hasBladeTrap`, `isMagicWeapon`, `qualityDamageStep`…) — acceptent tout `QualityCarrier` (Weapon **ou** ItemInstance). Comparent par **id STABLE** (≠ littéral FR).
- **Préséance `capabilities.beats`** : une qualité vaincue par une autre présente est retirée (« Imprécise prend le dessus » sur Précise LDB 62 l.323, Lente sur Rapide l.321) — géré dans `resolveQualities`.
- **Garde de parité** (`dispatch.test.ts`) : une qualité d'**Arme** de `qualities.json` doit avoir un `id` dans `qualityById` (sinon dans l'allowlist explicite) — force le triage, empêche l'empilement de qualités non câblées.

**Effets « moment »** : dégâts via `qualityDamageStep` (Dévastatrice `dmgDRMode:'maxUnits'`, Percutante `damageBonusUnits`, Inoffensive `negatesDamageAtouts`) ; effet à la touche via `passive` (op `onHit`-style ou hook combatFlow selon la qualité — ex. Assommante : Tête → F vs Endurance+Résistance → Sonné). **Filet anti-régression** : `golden-combat.test.ts` (snapshot de combats seedés × qualités) protège l'iso-comportement — relancer après toute retouche combat.

**Ce qui a survécu à la migration** :
- `ItemInstance.qualities` reste le porteur des qualités d'artisanat (Pratique/Peu Fiable/Bâclé/Laid/Volumineux/Solide/Léger/Raffiné) — même vocabulaire `QualityCarrier` que les armes/armures.
- `craftTestDRAdjust(carrier, success)` (Pratique +1/Peu Fiable −1 DR sur Test raté) + casse d'outil Bâclé sur Maladresse.
- `wearPenalty.ts` (pénalités de port d'armure « −N% en <Compétence> », déjà dans la donnée verbatim — pas de champ `wearPenalty` dédié) + `wornSocialMod` (Laid −10 Soc, objets équipés).

Lié à [[game-existant-poc-refactor-libre]], [[game-creature-registry]] (même principe « dépose une entrée → intégré »), [[game-roll-modal-pattern]], [[game-data-driven-architecture]] (les 3 canaux passive/effects/capabilities généralisés à tout le moteur, pas seulement les qualités).
