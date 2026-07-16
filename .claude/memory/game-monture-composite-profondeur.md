---
name: game-monture-composite-profondeur
description: "Rendu en selle refait — profondeur au niveau de l'OS + layer monté dédié + assise auto ; mécanique combat monté déjà complète avant."
metadata: 
  node_type: memory
  type: project
  originSessionId: b0fe312a-08a3-4ad4-9179-f8ff666c93f2
---

Le combat monté (RÈGLES) était DÉJÀ complet+testé avant cette session (`state/mount.ts` câblé dans combatFlow/store/ActionBar/MountTargetModal : appairage, Monter/Descendre, mods +20/−10/−20, mort→démonté, ciblage, charge dégâts Force+Taille monture, IA, éditeur). La partie PARKÉE = le **rendu en selle** (« petit soldat de face planté sur le dos »).

**Refonte rendu livrée (2026-06-08)** — le tri de profondeur iso était par ENTITÉ (`depth()=rx+ry`, groupes SVG atomiques) → le cavalier passait en bloc devant/derrière. Solution = profondeur au niveau de l'**OS** :
- `rig/composite.ts` — PUR `composeComposite(layers)` (concat os placés + z réassigné, un seul tri). 6 tests. Primitif réutilisable pour composites ATTACHÉS (cavalier, portage…). Familles non couvertes : décor (ligne de tri) / entité-entité libre (footprint). Tri par-os universel piégeux car rig **2D paper-doll** (pas de vraie profondeur/os) → on calibre une relation connue.
- `rig/mountedRig.ts` — **layer monté DÉDIÉ** (pas la pose à pied surchargée, qui se battait : lance visant la tête, jambes du même côté). `seatedBody(view)` + `mountedWeaponHold(handling, view)` (lance COUCHÉE avant, 1-main dressée…) → `mountedRest(view, weapon)`. Rênes = bras GAUCHE. De FACE/DOS : pas d'inclinaison torse (rig 2D penche de côté), jambes en straddle par angles **MIROIR** G+/D− (même signe = jambes du même côté). z-plan quad : jambe loin 4.5 / cœur 6.6 / jambe proche 8.2 (+z*0.01 garde l'ordre interne). **Assise AUTO** dérivée de l'os `tronc` (haut du barillet via `apply(matrix, ...)`) → s'adapte cheval↔loup et par vue, plus de seatY codé.
- `useRigAnim.ts`/`usePlanAnim.ts` — hooks d'anim EXTRAITS de RigToken/AnimatedPlanToken (délèguent, iso-comportement) → `MountedToken.tsx` consomme les 2 sans dupliquer bus/rAF. `MountedToken` = `addPose(mountedRest(view, arme), clipVivant)`, branché dans `IsoStage` (skip monture montée en boucle principale, 1 BodyToken, ombre partagée).
- **Bug bestiaire corrigé au passage** : `rig/quadruped/quadParts.ts` dessinait le sabot/patte à `translate(0, 22*ll)` = 22·longueur SOUS l'os du pied → sabot détaché + grounding fausse. Mis à l'os → pattes connectées pour TOUT le bestiaire quad.

Lance de cavalerie équipée via `entityRigProfile(name, seed, {weapon})`. Typecheck + 1724 tests verts. QC headless = `scripts/_qc-monture-merge.mts` (rastérise via le VRAI code, RÉPLIQUE seulement BodyToken+échelles — a divergé 1× : « penché de face » = QC passait la pose profil en face, prod OK).

**Reste (hors mécanique) : clips d'ATTAQUE montés** (charge lance couchée — pour l'instant clip à pied plaqué = approximatif), DIFFÉRÉ (coût tokens d'itération visuelle) ; **recette navigateur** (bloquée : Playwright tenu par session //). Prolonge [[game-rig-2d-paper-doll]], [[game-orientation-monde-facing]], [[env-use-powershell-not-bash]].
