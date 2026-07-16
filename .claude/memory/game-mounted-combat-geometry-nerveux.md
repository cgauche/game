---
name: game-mounted-combat-geometry-nerveux
description: Combat monté — géométrie = monture partout (reach/empreinte/affichage) + tour propre gated sur le Trait Nerveux (RAW).
metadata: 
  node_type: memory
  type: project
  originSessionId: 20fc75e2-6f80-4dc2-b3a3-ad20bfd778a8
---

Le combat monté (LDB 14) doit utiliser la géométrie de la MONTURE (pos + empreinte, souvent 2×2) pour TOUT ce qui touche la portée/adjacence/affichage du couple ; le cavalier 1×1 la suit. Lot de bugs corrigé 2026-06-29 (4 symptômes, 1 racine commune) :

- **Portée de mêlée — helper unique `mountedCombatDistance(battle,a,b)`** (`mount.ts`, = `combatDistance(combatGeomOf a, combatGeomOf b)`). À utiliser PARTOUT où on mesure attaquant→cible en mêlée. Sites corrigés : `attackPlan` (~l.1011, via geom/tgtGeom), `previewAttack` (~l.575), **`resolveAttack` (~l.474)**, `firedWeapon` (~l.224, via `combatants`), `firedAttackBlock` (~l.267), `combatSlice` FRAPPE non-charge (~l.854). Byte-identique non-monté (`mountOf`→undefined). Tests : `mounted-reach.test.ts`.
- **Soft-lock fin de tour après CHARGE montée (le vrai piège)** : `resolveAttack` mesurait la portée sur le cavalier 1×1 → après la charge (monture au contact, cavalier à 2) il renvoyait `null` → `attackRoll` vidait `pendingAttack` et **`return` SANS avancer la cascade** → `pendingCascade` orpheline (modale ne rend rien car pas de `pendingAttack`) → `combatAdvanceBlocked` bloque la fin de tour. Double fix : (1) `resolveAttack` mesure via `mountedCombatDistance` ; (2) **défense en profondeur** dans `attackRoll` : sur `!r`, appeler `advanceCombatJet(get)` pour fermer la cascade (jamais d'orphelin). NB `attackCancel` REFUSE un `fromCharge` (charge obligatoire) → aucune échappatoire manuelle, d'où l'importance du (2).
- **Affichage empreinte** (`IsoStage.tsx`) : `movePreviewEls` prend `footN` (empreinte du mobile) et dessine `footprintTiles(dest, footN)` ; halo de l'actif + curseur clavier dessinent l'empreinte de `mountOf(...)??active` ; la teinte de case SAUTE le cavalier (`isRider`) et marque la monture active si `c.riderId === activeC.id`. Sinon on voit un carré 1×1 décalé sous la monture.
- **Tour propre de la monture — RAW gated Nerveux** (Atlas `docs/raw/combat.md` Combat Monté pt.4, `LDB l.221`) : « une monture SANS le Trait Nerveux est un autre combattant à part entière et peut effectuer sa propre Action » ; une monture AVEC Nerveux ne peut PAS. Donc NE PAS retirer toutes les montures de l'ordre — seulement les Nerveux CHEVAUCHÉES. `isControlledMount(c) = !!c.riderId && hasTraitKey(c.traits,'nerveux')` (`mount.ts`) ; exclue de `combatOrder` (`combatSetup.ts`, comme les passagers de navire) ; splice/réinsert (`insertByInitiative`) à l'enfourchement/descente (`combatSlice.ts` battleMount/battleDismount). Un cheval ordinaire a `nerveux` ; un destrier non. Test : `mounted-turn.test.ts`. ⚠ `hasTrait` exige le registre `TRAITS` ; pour un trait de DONNÉE (profil créature) utiliser `hasTraitKey`.

Lié à [[game-monture-composite-profondeur]], [[game-footprint-multicases]], [[game-combat-keyboard-gamepad]], [[feedback-source-user-claims]] (la remarque user « pas RAW » était à moitié vraie — vérifier l'Atlas a évité de casser le destrier).
