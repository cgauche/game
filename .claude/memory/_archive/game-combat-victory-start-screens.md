---
name: game-combat-victory-start-screens
description: "Feature demandée (2026-06-09) : écran de DÉBUT de combat + écran de VICTOIRE (XP/or/butin assignable/vaincus). Butin = RÉUTILISER le flux marchand/fiche (mutualiser), pas de système parallèle."
metadata: 
  node_type: memory
  type: project
  originSessionId: e8da4937-e7c9-443e-bf71-432062e78922
---

**Demande utilisateur (approuvée via AskUserQuestion, 2026-06-09)** : deux « bookends » au combat, hors diagnostic lisibilité.

1. **Début de combat (PAS un écran plein) — RAFFINÉ 2026-06-09** : il faut VOIR le champ de bataille avant de valider. Donc PAS de modale plein écran : juste un **bouton « ⚔️ Commencer le combat » À LA PLACE de la barre d'action** pendant la phase `establishing` (champ + forces visibles, IA gelée). Clic → `establishing=false` + 1er tour. ⇒ rendre `establishing` PILOTÉ PAR LE BOUTON (retirer l'auto-clear `setTimeout(TEMPO.establish)` ajouté en LOT 2 ; ajouter une action `beginCombat()` = clear establishing + `maybeRunEnemyTurn`). La bannière « Le combat commence ! » peut rester.

2. **Écran de VICTOIRE** : « Victoire ! » + XP gagnée + or récupéré + butin (objets) à assigner + liste des ennemis vaincus, puis « Continuer » → exploration.

**Assignation du butin — DÉCISION : « comme le marchand ou la fiche perso ; mutualise si dupliqué ».**
- `buyItem(label, heroId)` (store.ts ~1285) : `itemFromTrapping(label)` → clone héros dest → `clone.items.push(it)` → `recomputeLoadout(clone)`. C'EST le flux objet→héros à réutiliser.
- `transferItem(uid, fromHeroId, toHeroId)` (store ~904) : déplace un objet entre héros (fiche).
- → **Extraire un helper `addItemToHero`/`giveItemToHero(label, heroId)`** utilisé par buyItem ET l'assignation de butin de victoire (mutualisation demandée).
- `giveItem` actuel (combatFlow ~201, store ~2696) ajoute juste le NOM à `inventory: string[]` (butin de groupe). Le butin assignable doit aller dans `Combatant.items` du héros choisi via le helper.

**Capture des récompenses à la victoire** : `checkBattleOver` (combatFlow ~1847) → `finalizeBattle` → `over:'victory'` → `applyEffects(onVictory)` (silencieux). Pour l'écran, CAPTURER ce que `onVictory` octroie : XP (Effet d'XP groupe), or (`giveMoney`), objets (`giveItem`) + la liste des vaincus (combattants `kind==='enemy'` hors de combat) dans un état `pendingVictory` ; l'écran lit ça. Objets en attente d'assignation (pas auto-versés à `inventory` si on veut l'assignation).

**3. Fenêtre de DÉBUT DE ROUND (initiative) — ✅ LIVRÉ (e0687a3, décision user « à chaque round comme avant avec l'initiative »)** : `RoundStartModal.tsx` SUPPRIMÉ (doublait la frise BattlePanel). Pause à CHAQUE début de Round (pas seulement si Chance) : `resolveRoundBoundary` tranche `checkBattleOver` PUIS pose `pendingRoundStart` (corrige cas latent préemption-vs-victoire) ; `maybeRunEnemyTurn` gardé par `pendingRoundStart` (IA gelée). UI in-situ : ActionBar = bouton « ▶️ Commencer le round N » à la place de la barre (`confirmRoundStart`) ; BattlePanel = bandeau « Début du Round N » + bouton « ⏫ Agir en premier (Chance) » par ligne éligible. Éligibilité = prédicat PUR UNIQUE `canActFirst(c, battle)` dans `turnEconomy.ts` (auj. `fortune>0` + pas déjà en tête + en état d'agir, LDB 17 l.27 ; point d'extension futurs Atouts « Rapide »/talent « Tir rapide »). `confirmRoundStart` ré-ajoute le Test de Calme (`maybeOpenHeroPsych`) au début de Round. `ActiveModal` : clé `roundStart` retirée. Tests : canActFirst 5 cas + pause systématique + gel IA.

**État (2026-06-09)** : ✅ **Bouton « Commencer le combat »** LIVRÉ (e9ef517 — establishing piloté par bouton, plus d'auto-timeout, champ visible). ✅ **Écran de VICTOIRE** LIVRÉ : capture récompenses (combatFlow) + `pendingVictory`/`giveItemToHero`/`dismissVictory` (store) + composant `VictoryScreen` plein écran (XP/or/butin assignable/vaincus + Continuer) ; BattlePanel réduit à la défaite ; butin via `addItemToHero` (f48dda1) mutualisé marchand. ✅ **Fenêtre début de round (initiative)** LIVRÉE (e0687a3) — cf. point 3 ci-dessus (pause à chaque round, in-situ, plus de modale doublon). Suite 1949 verte, tsc clean. Plan : (a) mutualiser `giveItemToHero` ; (b) `pendingVictory` capturé à la victoire + VictoryScreen (XP/or/butin assignable/vaincus + Continuer) ; (c) écran de début (aperçu forces + Commencer, gate `establishing`). Prolonge [[game-combat-legibility-roadmap]] et [[game-marchand-v1]].
