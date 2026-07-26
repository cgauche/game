---
name: game-items-unified-vocabulary
description: "Les objets (trappings) parlent le vocabulaire unifié — passive GameOp[] + capabilities + résolveur hasCapability cross-source ; modèle inventaire RAW (porté/tenu/rangé + contenants) ; effets gatés sur le port."
metadata: 
  node_type: memory
  type: project
  originSessionId: 8ba2f4e3-7607-427c-936e-94647153705c
---

Refonte (juin 2026, 6 commits `f57a5b0d`→`3f238146` sur feat/wfrp4-rpg-foundation) : les **objets** ont
rejoint le vocabulaire mécanique unifié des traits/qualités/sorts. Avant = champs ad-hoc (`skillBonus`,
`light`, 5 marqueurs booléens) ; après = les **3 canaux** sur `TrappingData` : `passive: GameOp[]` +
`capabilities: ItemCapabilities` (+ `effects` dispo). Détails :

- **`skillBonus` → `passive:[{op:'skillMod'}]`** (op EXISTANT). `itemSkillBonus` supprimée ; le bonus passe
  par `passiveMods`→`passiveSkillSum`. Tue la dette `no-json-fields` (trappings ne retombe plus en kind:json).
- **5 marqueurs** (`preventForcedDrop`/`weatherProtection`/`isShelter`/`isRations`/`isGrimoire`) →
  `capabilities: ItemCapabilities`, lus par le **résolveur UNIQUE `src/engine/capabilities.ts`** :
  `itemCapability(it,cap)` (par-OBJET, catalogue par trappingId, NON gaté — « cet objet EST une ration ») +
  `hasCapability(c,cap)` (agrégat par-PERSONNAGE CROSS-SOURCE : objets portés/tenus + qualités + traits +
  maladies, GATÉ sur le port). Les anciens lecteurs par-source (`traitCapability`…) restent, réutilisés par
  `hasCapability` (pas un sweep total des call-sites).
- **`light` → op GameOp** (`{op:'light',radiusTiles}`) : côté OBJET (passive) inerte dans applyOps, lu par
  `combatantLights` (`vision.ts`) ; côté SORT, `case 'light'` actif → `ActiveEffect.light` + durée. **Items
  ET sorts émettent de la lumière** (le sort `lumiere` éclaire enfin, fini l'`op:narrative` cosmétique).
  `TrappingData.light` SUPPRIMÉ ; `PropData.light`/`SceneEntity.light` (décor) CONSERVÉS.
- **Inventaire RAW** (Phase 0) : `equipped` = porté (Enc −1, LDB 61 l.21) généralisé aux accessoires misc
  (`isWearable`) ; **contenants** `TrappingData.container{capacity}` + `ItemInstance.inside` (LDB 64 : le
  contenu rangé est absorbé par le contenant, ne compte plus à l'Enc) ; actions `stowItem`/`canStow`,
  UI fiche (Porter / ranger-sortir).
- **Décision actée** : un effet d'objet n'agit que **PORTÉ (`it.equipped`) ou TENU (`c.weapons`)**, pas rangé
  (`inside`) — interprétation ASSUMÉE (le RAW ne formalise que l'Enc −1, PAS le gating d'effet). `passiveMods`
  ET `hasCapability` partagent la garde `isHeld`.
- **`derivedWeapon` GARDÉ structuré** (PAS migré en `grantWeapon` : mécanisme différent — grantWeapon crée un
  item conjuré temporaire — + couplé au système de prothèse `prosthesisTrained`). Décision : pas la même dette
  que skillBonus, déjà cohérent (data-driven, gaté, par-id).

Garde `hasCapability` la garde du port, et le résolveur cross-source, au moindre ajout de capacité/canal.
Cf. [[game-quality-effect-channels]], [[feedback-jamais-git-surgery-arbre-partage-actif]].
