# Destin & Résilience sacrifiés

- **Date** : 2026-06-05
- **Jalon** : 1 (profondeur du combat) — suite directe du socle « Blessures critiques & mort ».
- **Statut** : design validé (déclencheur Destin = **coup létal + mort lente**), en attente de relecture spec.
- **Principe** : *rien d'inventé* + pas de MJ. Source : `Source/Warhammer v4 - Livre de base version corrigée/17 - Destin et Résistance.md`.

## Canon (vérifié)

- **Sacrifier un Point de Destin** (ch.17 l.31-35), au moment où la mort est imminente :
  - **« Meurs un autre jour »** : au lieu de mourir, le Personnage est mis KO / laissé pour mort / éjecté de l'action — il **survit mais ne prend plus part à la rencontre actuelle**.
  - **« Comment ça a pu rater ? »** : évite **complètement les Dégâts** par un coup de chance, **reste en combat** (mais sans certitude de survie aux Rounds suivants).
- **Sacrifier un Point de Résilience** (ch.17 l.71-73) :
  - **« Je ne faillirai pas ! »** : au lieu de lancer, **choisir le résultat** → réussite garantie ; sur un Critique, **choisir la Localisation** ; sur un **Test opposé, l'emporter avec DR +1** ; utilisable **même après un Test échoué**.
  - **« Je te renie ! »** : refuser une mutation — **non modélisable** (aucun système de Corruption/mutations dans le jeu) ; à faire quand ce système existera (PAS « laissé au MJ », cf. mémoire « pas de MJ »).

## Décisions de design

| Sujet | Décision |
|---|---|
| Déclencheur Destin | **coup létal** (résultat « Mort » d'une table) **ET** **mort lente** (fin de Round : Inconscient + 0 PB + critiques > BE) |
| « Comment ça a pu rater ? » | seulement sur **coup létal** (il y a un coup à annuler) ; restaure les PB d'avant le coup, annule le critique (criticalWounds−1), pas de mort, reste en combat |
| « Meurs un autre jour » | sur les deux cas : `outOfRencontre = true` (+ Inconscient) → hors de combat **mais vivant** ; coûte 1 Destin |
| « Accepter le sort » | mort |
| « Je ne faillirai pas ! » | bouton dans les 5 modales de jet, gaté `resilience>0` **et** issue défavorable ; force le succès (opposé : l'emporte **DR +1**) ; coûte 1 Résilience |
| Choix de localisation d'un Critique | **différé** (note) — nécessite de plomber une localisation choisie dans `rollCritical` ; v1 = réussite garantie |
| `outOfRencontre` | nouveau champ ; ajouté à `isOutOfAction` (vivant mais éjecté) ; ignoré par l'upkeep de mort |
| Dépense Destin/Résilience | décrémente `fate`/`resilience` sur le clone `battle` (gap persistance Jalon 5, cohérent avec l'existant) |
| IA | l'IA ne dépense ni Destin ni Résilience (suspension réservée aux héros) |

## Architecture

### A. État & suspension — `src/state/store.ts`
- **`pendingFateSave: { heroId: string; source: 'hit' | 'slow'; restoreWounds?: number } | null`** (déclaré dans `GameState`, init `null`, reset des tests).
- **Chokepoint unique** `finalizeHeroDeath(hero, source, restoreWounds?)` :
  - si `hero.kind === 'hero'` et `(hero.fate ?? 0) > 0` → set `pendingFateSave` (ne finalise PAS la mort) ;
  - sinon → `hero.dead = true`.
- **Coup létal** : dans `applyCriticalToTarget`, remplacer `target.dead = true` par un appel qui, pour un héros à Destin, déclenche `pendingFateSave { source:'hit', restoreWounds: <PB avant le coup> }`. `applyAttackResult` passe `currentBefore` au pipeline pour le `restoreWounds`.
- **Mort lente** : sortir la *finalisation* de la mort de `tickDeath` (qui ne fait plus que 0 PB→Inconscient + signaler la condition) ; `advanceTurn` (passage de Round) appelle `processRoundBoundaryDeaths()` : tant qu'un héros remplit la condition de mort avec Destin → `pendingFateSave { source:'slow' }` (pause) ; sinon finalise les morts sans Destin.
- **Suspension** : `advanceTurn`, `maybeRunEnemyTurn`, `runEnemyAI` bailent en tête si `pendingFateSave` est non-null (comme `battle.over`). Le passage de fin de Round est scindé : `finishRoundBoundary()` (décrément d'Avantage, `decayEngagement`, pause `pendingRoundStart`, sélection de l'acteur, IA) est appelé après que toutes les morts de Round sont résolues.
- **Actions** :
  - `fateNegate()` : ('hit' seulement) restaure `restoreWounds`, `criticalWounds−1`, `fate−1`, ferme la modale, reprend (`resumeEnemyTurn`).
  - `fateSurvive()` : `outOfRencontre=true` + Inconscient, `fate−1`, reprend selon `source` ('hit' → `resumeEnemyTurn` ; 'slow' → `processRoundBoundaryDeaths` puis `finishRoundBoundary`).
  - `fateAccept()` : `dead=true`, reprend de même.
  - `resilienceForceSuccess(kind)` : 5 miroirs (test/attack/defense/cast/disengage) — force l'issue favorable du `pending*` (opposé : `resolveOpposed` avec DR mover +1 ; ou pose directement le résultat gagnant), `resilience−1`.

### B. Moteur — `src/engine/conditions.ts` + `types.ts`
- `types.ts` : `Combatant.outOfRencontre?: boolean`.
- `isOutOfAction(c)` : ajouter `|| c.outOfRencontre === true`.
- `tickDeath(c)` : ne finalise plus `dead` ; expose `inDeathCondition(c)` = `Inconscient && wounds≤0 && (criticalWounds > BE)` (pur) ; la finalisation/pause vit dans le store.

### C. UI — `src/ui/*`
- **`FateSaveModal.tsx`** (nouvelle) : titre « Le Destin… », montre le héros + le contexte ; boutons « 🍀 Comment ça a pu rater ? » (si `source==='hit'`), « 🛟 Meurs un autre jour », « ☠️ Accepter le sort » + le coût (1 Destin restant N). Montée dans `CampaignView`.
- **Bouton Résilience** dans les 5 modales : composant frère `ResilienceButton` (ou param de `ChanceButtons`) « 🔥 Réussite garantie (Résilience N) », gaté `resilience>0 && issue défavorable`.

## Tests (TDD)
- `conditions`/`death` : `isOutOfAction` avec `outOfRencontre` ; `inDeathCondition`.
- store — Destin :
  - coup **létal** sur un héros à Destin → `pendingFateSave{source:'hit'}` (pas mort) ; `fateNegate` restaure les PB + `fate−1` + reste en combat ; `fateSurvive` → `outOfRencontre` + vivant + `fate−1` ; `fateAccept` → mort.
  - **mort lente** d'un héros à Destin en fin de Round → `pendingFateSave{source:'slow'}` ; `fateSurvive` l'éjecte vivant ; reprise du Round.
  - héros **sans Destin** → mort directe (pas de pause).
  - l'IA reste **suspendue** tant que `pendingFateSave` non-null.
- store — Résilience : `resilienceForceSuccess` force une touche d'attaque ratée en succès (opposé DR +1) ; un Test raté en succès ; `resilience−1`.

## Hors périmètre
- « Je te renie ! » (refus de mutation) — dépend du système de Corruption/mutations (non modélisé).
- Choix de **localisation** d'un Critique via « Je ne faillirai pas ! » (différé).
- Récupération de Destin/Résilience (récompense, Motivation) → Jalon 5.

## Fichiers touchés (prévision)
- `src/engine/types.ts` (`outOfRencontre`), `src/engine/conditions.ts` (`isOutOfAction`, `tickDeath`/`inDeathCondition`)
- `src/state/store.ts` (`pendingFateSave`, `finalizeHeroDeath`, scission `advanceTurn`/`finishRoundBoundary`/`processRoundBoundaryDeaths`, gardes IA, actions Destin + `resilienceForceSuccess`) + tests
- `src/ui/FateSaveModal.tsx` (nouveau), `src/ui/CampaignView.tsx` (montage), `src/ui/ResilienceButton.tsx` (ou extension `ChanceButtons`) + les 5 modales
- `ROADMAP.md`
