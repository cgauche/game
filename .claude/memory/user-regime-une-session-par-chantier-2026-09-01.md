---
name: user-regime-une-session-par-chantier-2026-09-01
description: "Décision utilisateur 2026-09-01 soir — « Faut arreter les sessions en backgrounds, ca m'inquieye » puis option retenue « Finir le merge, puis une seule session par chantier » : UNE session par épic, arbre principal RÉSERVÉ à l'intégration, suite complète + tsc FULL avant push, pas de push sur CI rouge, fan-out ≤ 1 par commit, trouvailles en inventaire au ticket de la vague, aucune vague hors plan sans validation DIRECTE"
metadata:
  type: feedback
---

**Verbatims (2026-09-01)** : « Faut arreter les sessions en backgrounds, ca m'inquieye » (relayé par game-a3, ordre d'arrêt immédiat) ; décision via AskUserQuestion dans la session game-a3 : « Finir le merge, puis une seule session par chantier » ; confirmation DIRECTE dans cette session (AskUserQuestion) : « Oui, reprends » (tuples #1659 → B1 #1657 → #1620 (iii), un train à la fois).

**Contexte** : deux sessions orchestratrices sur le même arbre pendant 48 h (#1463 × #1457/#1620/#1657) — ~55 trains, zéro conflit d'index, mais re-baselines croisées des plafonds, docs régénérés sur le WIP du voisin, trois rouges CI par trous de gate, worktrees verrouillés, et un diagnostic de DÉRIVE : la vague `grammaire` et le juge `tuples` ont été ouverts sur un arbitrage RELAYÉ par l'autre session, jamais validé directement par l'utilisateur ici.

**Why :** la parallélisation sur les mêmes fichiers coûte plus qu'elle ne rend, et une autorité relayée n'est pas une validation — [[feedback-brief-fait-autorite-grounding-seconde-main]], [[feedback-plan-approuve-sexecute-sans-relance]] (le plan approuvé, pas ses extensions).

**How to apply :**
1. UNE session par épic ; l'arbre principal est réservé à l'INTÉGRATION : rien n'y est stagé ni commité, seulement `git pull --ff-only` après un push ; tout train se code, se gate et se commit dans un WORKTREE à `npm ci` sur le sha posé.
2. Avant tout push : suite COMPLÈTE + `tsc` FULL, sorties lues au fichier ; jamais de push si le dernier run CI de `main` est rouge (attendre ou corriger) ; `gh run watch`, « posé » seulement au vert ; un doc dérivé touché se régénère SUR L'INDEX dans le train qui le périme.
3. Fan-out ≤ 1 s'applique à TOUT commit ; les trouvailles hors lot vont dans UN commentaire d'inventaire du ticket de la vague — zéro ticket par trouvaille.
4. Aucune vague hors du périmètre validé sans validation DIRECTE de l'utilisateur dans la session (une option AskUserQuestion) ; un arbitrage relayé par une autre session n'autorise rien.
5. Pilotage de l'épic réécrit à chaque train posé ; un seul codeur lourd à la fois, recetteurs séquentiels.
