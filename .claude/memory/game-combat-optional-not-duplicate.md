---
name: game-combat-optional-not-duplicate
description: "Étendre un système combat-only au hors-combat = rendre le flux EXISTANT combat-optionnel, PAS dupliquer"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 024cd482-0bab-4295-9fab-7d5591050488
---

Pour porter un système « codé combat-only » vers le hors-combat (audit des coutures B/A/C/D), **rendre le flux EXISTANT optionnel au combat** plutôt que d'écrire un flux parallèle.

**Why:** l'utilisateur a explicitement dit « Évite de dupliquer » quand je partais sur un flux hors-combat self-contained qui aurait recopié la logique d'effets de l'incantation (parseHeal/parseCharBuffs/parseConditionEffect/miscast). Dupliquer la résolution/les effets = dette + divergence.

**How to apply — patron complet d'une action joueur combat-ou-hors-combat :** `résoudre (actorIn) → appliquer l'effet (spécifique) → finaliser (finishPlayerAction)`. Les deux bouts (résolution + sortie) sont MUTUALISÉS ; seul l'effet est propre à l'action.
- **Résolution — `src/state/combatOrParty.ts`** (commit `0d8b715`) : `actorIn(state, id)` (= `battle?.combatants ?? party`) + `touchActors(state)` (patch re-rendu combat→battle / hors→party). Inférées de `battle != null` (une modale `pending*` gèle tout → le contexte ne change pas en cours de flux ; pas de flag par modale ; `PendingHeal.inCombat` supprimé).
- **Sortie — `finishPlayerAction(get, set, lines)`** (combatFlow, commit `1b89a0e`) : en combat conso de l'Action (`acted`/`action:null`/`selectedSpell:null`) + `battle.log` + `checkBattleOver` ; hors combat → `journal`. Un seul point ; appelé par `applyCast`, `healConfirm`, `focusConfirm`.
- Les actions `cast*`/`focus*` perdent leur garde `if(!battle)` et deviennent pool-aware (via `actorIn`/`touchActors`).
- Le cœur d'application d'effet rendu **battle-nullable** : `applyCast` (combatFlow) — en combat sortie `battle.log` + `checkBattleOver` ; hors combat sortie `journal`. MÊMES effets, MÊMES résolveurs purs ; le reste est journalisé **sans rien inventer** (CLAUDE.md règle 7 « Pas de MJ » + « ne rien inventer »).
- Modales identiques (`CastModal`/`FocusModal`) rendues avec `battle?.combatants ?? party`.
- Comportement combat **préservé** (quand `battle` est vérité, chaque branche est inchangée) — garde-fou : suite complète verte.
- Nouvelle action d'ouverture hors-combat minimale (`oocCastSpell`/`oocFocusSpell`) + UI (section « Sorts » de la fiche, miroir du bouton « Soigner » hors-combat du rig).

**Nuance vs [[game-jet-modale-exhaustif]] couture C** : la Psychologie à la rencontre (`encounterPsychFlow`) a pris la voie self-contained car elle ne réutilisait QUE des résolveurs purs (zéro logique d'effet à copier). Le critère = « est-ce que ça dupliquerait une vraie logique d'effet ? » → oui ⇒ flux combat-optionnel ; non ⇒ fichier dédié acceptable.

Couture D (incantation hors combat) livrée ainsi : commit `8788140`. Gate offensif = `isMagicMissile` (seul marqueur offensif des données = « Projectile magique » ; un classifieur « non-offensif » plus large inventerait une catégorie).
