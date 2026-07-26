---
name: game-combat-keyboard-gamepad
description: Combat 100 % clavier + manette via un curseur unifié qui réutilise le pipeline survol→commit.
metadata: 
  node_type: memory
  type: project
  originSessionId: 20fc75e2-6f80-4dc2-b3a3-ad20bfd778a8
---

Le combat est jouable **sans souris** (clavier ET manette). Architecture « curseur de combat unifié » — clavier et manette alimentent UN SEUL état, zéro chemin parallèle.

- **`src/state/combatCursor.ts`** (PUR, testé `combatCursor.test.ts`) : `nextCursorTile(cur,dir,dims,activePos)` choisit le voisin de grille dont le **centre projeté** (`tileCenter`) colle le mieux à la direction ÉCRAN (produit scalaire sur les 8 voisins) → curseur « suit les yeux », gère rot caméra + vue du dessus sans cas particulier. `cursorCommitIntent(s,cur)` = RÉPLIQUE de la branche `battle` de `performClick` (parité souris).
- **Store** (`store.ts` `combatCursor`, actions dans `combatSlice.ts`) : `moveCursor`/`snapCursorToTarget`/`commitCursor`/`clearCursor`. `commitCursor` délègue à `battleClickEntity`/`battleClickTile` EXISTANTS (intents coop-sérialisables). `cyclePrevTarget` ajouté à `targeting.ts`. Curseur vidé à l'avance de tour + fin de combat (`combatFlow.ts` `advanceTurn`/`finishCombatEnd`).
- **`keybindings.ts`** : bindings `cursor-up/down/left/right`, `cursor-commit` (Enter, AVANT `end-turn`), `cursor-cancel` (Escape), `target-next` (Tab→`snapCursorToTarget(1)`), `target-prev` (Backquote). Export **`runBindingById(id,get)`** = table d'intentions PARTAGÉE clavier+manette.
- **`IsoStage.tsx`** : `effHover = combatCursor?.tile ?? hover` / `effFocusId = combatCursor?.snappedId ?? hoverCombatantId` substitués dans les 3 memos de survol (réticule/halo/aperçu déplacement) → tout le rendu existant marche depuis le curseur ; losange `.combat-cursor` ; la souris reprend la main au `pointermove` (`clearCursor`).
- **`Modal.tsx`** : `useModalA11y` — Entrée clique `.modal-actions .btn-primary` visible ; `visibleFocusables` exporté (partagé piège Tab + nav manette).
- **`useGamepad.ts`** (monté par `CampaignView`) : boucle rAF, mapping standard W3C, dispatche les MÊMES ids via `runBindingById` ; A/B/X/Y contextuels (`padContext` map/menu/modal) ; nav menus/modales = focus DOM (`visibleFocusables` + `.focus()/.click()`). Shim DEV `window.__wfrpPad`/`__wfrpPadDir` (pattern `__wfrpSetHover`) → `__wfrp.pad(name)`/`__wfrp.padDir(dir)` dans devtools (testable sans pad).

Vérifié en jeu : Tab→Enter→Enter→Enter résout une attaque clavier-only ; `padDir`/`pad('RB')`/`pad('A')`/`pad('B')`/`pad('Y')` rejouent les mêmes intentions. Lié à [[game-roll-modal-pattern]], [[game-unified-attack-click-model]], [[game-modal-arbiter-dead-state]].
