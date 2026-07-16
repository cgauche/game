---
name: game-weapon-registry
description: Les 48 armes vivent dans le registre auto-chargé weapons/defs/ (1 arme = 1 WeaponDef unifié forme+art) ; weaponForms/equipment dérivent ; weaponsArmour.ts supprimé ; palette réservée pour skins légendaires (passe couleur transverse à venir).
metadata: 
  node_type: memory
  type: project
  originSessionId: 6a091869-bf82-4c57-9848-2d25a75eaedb
---

Depuis 2026-06-07, les ARMES sont la **5e famille** du registre générique « 1 def = 1 fichier » (`scripts/gen-registry.mjs`, même mécanisme que [[game-creature-registry]]). Chaque `src/gameIso/rig/parts/weapons/defs/<slug>.ts` exporte `weapon: WeaponDef = {slug,label,type,group,target,art}` — **FORME + ART** dans une seule source de vérité par arme (comme parts monstrueuses/tenues). Le codegen émet `weapons/_registry.generated.ts` (`WEAPON_DEFS`).

`weaponForms.ts` (`WEAPON_FORMS`) et `equipment.ts` (la map `WEAPONS` d'art) **DÉRIVENT** de `WEAPON_DEFS`. equipment ne garde que les fallbacks hors-forme (`epee`/`hache`/`masse`, cibles de synonymes/groupes non dessinées). L'ancien monolithe `generated/weaponsArmour.ts` est **SUPPRIMÉ** ; l'armure (`GENERATED_ARMOUR`) extraite dans `generated/armour.ts`. `_ingest-weapons-redo.mts` écrit désormais 1 def à la fois (plus de monolithe à préserver).

**Couleur / skins légendaires — FAIT pour les armes (2026-06-07)** : les 48 defs ont leur art en `@tokens` (`@metal/@cuir/@accent` + ombres `@O`/`@H`) + une `palette` (StoredPalette = hex EXACT → défaut **sans perte**). Tokeniseur déterministe `_tokenize-weapons.mts` (classif HSL par valeur ; dégradés → leur **mid réel** sinon les canons d'arme à feu blanchissent). `equipment.weaponPart` résout l'art contre la palette du DEF, et re-résout contre `Weapon.skin` (override par-OBJET) → skin légendaire recolore lame/bois/or indépendamment. Chaîne : `ItemInstance.skin → recomputeLoadout → Weapon.skin → weaponPart`. ⚠️ Distinct des tenues : une arme suit SA palette (par-objet), une tenue suit le PORTEUR (`composeRig` tmap perso, `CAREER_PALETTES`). Système de palette = `palette.ts` (`buildTokenMap`/`applyTokenMap`, ombres dérivées ×0.78/×1.18).

**Tenues — tout tokenisé (2026-06-07)** : tenues de CARRIÈRE déjà tokenisées (`careerTenuesAuto.ts` + `CAREER_PALETTES`, via workflow classify-colors → `_tokenize-tenues.mts`). Les **9 archétypes** de classe (`tenues/defs/`, fallback pour 7/71 carrières exotiques) sont désormais NORMALISÉS pareil : art en `@vet1/@vet2/@metal` + `TenueDef.palette` (StoredPalette, ajouté au type) exposée par `CLASS_PALETTES`. Résolution UNIFIÉE `tenuePaletteFor(career)` (career.ts) = `CAREER_PALETTES[career] ?? CLASS_PALETTES[careerClass(career)]`, consommée par `composeRig` (remplace l'accès direct `CAREER_PALETTES[career]`). ⚠️ tenue = palette du PORTEUR ; arme = palette de l'OBJET (cf. ci-dessus). Voir [[game-weapon-handling-axis]] pour l'anim (axe distinct).
