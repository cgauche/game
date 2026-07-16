---
name: game-weapon-art-id-routing
description: "L'art arme/bouclier route par `shape` (id de def), jamais par libellé — résolu au spawn, pas au runtime"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7fda4d63-abe3-41d4-9a6d-e37d4b955a9e
---

L'ART d'arme/bouclier est routé par un **id de forme STABLE** (`shape` = slug de `WeaponDef`/`ShieldDef`),
porté en DONNÉE, exactement comme l'apparence des créatures (`appearance.species` → `defById`). **Plus
aucun routage par libellé/regex au RUNTIME** (commit `abdadeaa`, 2026-06-28).

Chaîne : `TrappingData.shape` (peuplé sur 87 armes + 4 boucliers) → `ItemInstance.shape` (stampé par
`itemFromTrappingById`) → `Weapon.shape` (propagé par `buildWeapon`/`toWeapon`/`mannedPosteWeapon`).
Attaques naturelles de corps = `Weapon.natural` (flag `TraitInstance.natural` OU capacité typée
`capabilities.naturalWeapon`) → `weaponFamily` renvoie `''` (le membre du rig fait foi) ; le KIND
(`morsure`/`cornes`/`tentacules`) est stampé en `Weapon.attackKind` pour la pose.

Routage RUNTIME (`src/gameIso/rig/parts/equipment.ts`) : `weaponFamily` = natural→'' ; `w.form`
(=trapping-id d'arme invoquée) → `findTrappingById(form).shape` ; `w.shape`→slug ; repli **Groupe**
(`ART_BY_GROUP[weaponGroupKey]`, id, pas libellé). `shieldPart` = `x.shape`→`SHIELD_BY_SLUG` ; fallback
rondache. Anim idem : `handling.ts`/`weaponClips.ts` par `w.shape`/`w.attackKind`.

Résolution **label→shape uniquement à l'AUTHORING/SPAWN** (autorisé, cf. `statEntry.ts` : parsing
label→structure jamais au runtime) : `weaponFromLabel` (override de scène `weapon:'X'`) + `shapeForLabel`
(`creatureEquip`, arme nommée de créature). Les libellés de scène doivent être CANONIQUES (un
`weapon:'Hache'` non catalogué → générique ; utiliser `'Grande hache'`).

SUPPRIMÉS (n'existent plus) : `ART_BY_LABEL`, `SHIELD_BY_LABEL`, regex `NATURAL_ATTACK`, table `SYNONYMS`,
`formSlug`. Bug corrigé : armes invoquées (`grantWeapon` pose `form`=trapping-id) rendent enfin leur
silhouette (avant : trapping-id testé contre une table de libellés → échec silencieux → épée générique).

**Choix de forme « Arme simple » LIVRÉ** (commits `39377652`+`fa0968ab`, 2026-06-28). `hache`/`masse` (jadis
arts morts retirés) RÉ-INTRODUITS comme **vraies defs** `weapons/defs/`, gradient `g_axe` rétabli (référencé) :
le picker en avait besoin. Le def `gourdin` relabellé « Arme simple »→« Gourdin » (forme à part). Trapping
`arme-simple` : `shape='epee'` (défaut) + nouveau `TrappingData.formChoices: string[]` = `[epee, hache, masse,
marteau_guerre, demi_lance]` (LDB 62/p294). **Zéro hardcode d'art d'arme** : `epee` (jadis hardcodée
car art DIRECTIONNEL front/dos/profil) est devenue une def normale — commit `c887e83d` a élargi
`RigHeldDef.art: string → PartArt` + ajouté `applyTokenMapArt` (relève `applyTokenMap` sur les 3 vues ;
`applyTokenMap` reste string-only). Toute forme d'arme = une def routée par slug, plus AUCUNE exception
(`ART_BY_SLUG`/`WEAPONS`/`weaponFormLabel`/test nettoyés). Goldens byte-identiques (1479 snapshots inchangés).
Principe acté : on ne justifie un hardcode QUE pour l'irréductible (vocabulaire/bootstrap), jamais un cas
spécial supprimable — la « justification par le type » est circulaire si le type est notre propre choix.
Action `partyFlow.setItemShape(heroId, uid, shape)` (valide ∈ formChoices, no-op sinon, `mutLoadout`→recompute
→ `Weapon.shape` actif suit) ; UI `FormPicker` (`CharacterSheet.tsx`, onglet Sac) = `MediaSelect`+`ItemIcon` par
shape, libellés `weaponFormLabel`(=`WeaponDef.label`), verrouillé en combat. Cosmétique RAW (stats identiques).

Cf. [[game-weapon-registry]], [[game-ids-internes-libelles-display-multilangue]], [[game-namematch-deleted]],
[[game-swarm-data-driven-grounding]], [[game-itemicon-mediaselect-primitives]].
