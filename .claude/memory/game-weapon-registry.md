---
name: game-weapon-registry
description: Les 90 armes vivent dans le registre auto-chargé weapons/defs/ (1 arme = 1 WeaponDef unifié forme+art) ; weaponForms/equipment dérivent, l'armure dérive de armour/defs/ ; palette réservée pour skins légendaires (passe couleur transverse à venir).
metadata: 
  node_type: memory
  type: project
  originSessionId: 6a091869-bf82-4c57-9848-2d25a75eaedb
---

Depuis 2026-06-07, les ARMES sont la **5e famille** du registre générique « 1 def = 1 fichier » (`scripts/gen-registry.mjs`, même mécanisme que [[game-creature-registry]]). Chaque `src/gameIso/rig/parts/weapons/defs/<slug>.ts` exporte `weapon: WeaponDef = {slug,label,type,group,target,art}` — **FORME + ART** dans une seule source de vérité par arme (comme parts monstrueuses/tenues). Le codegen émet `weapons/_registry.generated.ts` (`WEAPON_DEFS`).

`weaponForms.ts` (`WEAPON_FORMS`, **90** formes) et `equipment.ts` **DÉRIVENT** de `WEAPON_DEFS` : `ART_BY_SLUG` = l'ensemble des slugs catalogués, et `ART_BY_GROUP` ne fait que nommer la forme par DÉFAUT d'un Groupe canonique (`base`→`epee`, `escrime`→`rapiere`, `hast`→`lance`…) — la forme visée est TOUJOURS une def du registre, jamais un art à part. L'ARMURE suit le MÊME modèle : la table `ARMOUR` (`src/gameIso/rig/parts/armour/index.ts`) DÉRIVE des fichiers `armour/defs/` — ajouter une armure = déposer un fichier, jamais éditer une table. `_ingest-weapons-redo.mts` écrit 1 def à la fois.

**Couleur / skins légendaires — FAIT pour les armes (2026-06-07)** : les 90 defs ont leur art en `@tokens` (`@metal/@cuir/@accent` + ombres `@O`/`@H`) + une `palette` (StoredPalette = hex EXACT → défaut **sans perte**). Tokeniseur déterministe `_tokenize-weapons.mts` (classif HSL par valeur ; dégradés → leur **mid réel** sinon les canons d'arme à feu blanchissent). `equipment.weaponPart` résout l'art contre la palette du DEF, et re-résout contre `Weapon.skin` (override par-OBJET) → skin légendaire recolore lame/bois/or indépendamment. Chaîne : `ItemInstance.skin → recomputeLoadout → Weapon.skin → weaponPart`. ⚠️ Distinct des tenues : une arme suit SA palette (par-objet), une tenue suit le PORTEUR (`composeRig` tmap perso, palette résolue par `tenuePaletteFor`). Système de palette = `palette.ts` (`buildTokenMap`/`applyTokenMap`, ombres dérivées ×0.78/×1.18).

**Tenues — tout tokenisé (2026-06-07)** : chaque tenue est une def `tenues/defs/<id>.ts` (**109**), art en `@vet1/@vet2/@metal` + `TenueDef.palette` (StoredPalette, portée par le type). Résolution UNIFIÉE `tenuePaletteFor(tenue)` (`src/gameIso/rig/parts/career.ts`), en miroir EXACT de `tenueFor` : clé = id STABLE de tenue (`CAREER_TENUE_BY_ID[id] ?? id` → `TENUE_PALETTE_BY_ID`), sinon palette par id de CLASSE direct (#533), sinon aucune (corps Nu). Aucune tenue générique par CLASSE n'est chargée — une classe sans def dédié rend un corps Nu (décision utilisateur 2026-07-21, garde `tenues/tenues.test.ts`). ⚠️ tenue = palette du PORTEUR ; arme = palette de l'OBJET (cf. ci-dessus). Voir [[game-weapon-handling-axis]] pour l'anim (axe distinct).
