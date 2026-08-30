---
name: project-audit-workflow-2026-08-30-regime-de-fermeture
description: "Audit complet du workflow (2026-08-30, 8 sondes Opus) : la dérive du stock (849 ouverts, 4,5:1) était le comportement NOMINAL du système — chiffres de référence + régime de fermeture/vague/épique adopté (plan approuvé), tickets #1591-#1593"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8eebe977-36b3-422e-811b-8dd35ceb3adc
  modified: 2026-08-30T17:30:01.821Z
---

Audit demandé par l'utilisateur (« le stock ne fait qu'augmenter », « dans une épique on finit par diverger et faire des travaux incomplets »). Plan approuvé le 2026-08-30. **Chiffres de référence** (base de comparaison des prochains audits) :

- Flux : 849 ouverts, création 114-170/sem vs fermeture ~26/sem ; **0 % de fermeture pour un ticket >30 j** (404 atteints, 0 fermé) ; la sévérité ne pilote rien.
- Coût : 1,8 h-mur/ticket ; cérémonie ~5-6 h/vague en coût FIXE, amortie ×3 par lots de 4-6 ; parallélisme 1,22×.
- Agents : 32 % du temps actif en attente runner, dont 33 % de relances redondantes (tsc 51 s ×19 chez un codeur, relance-pour-relire) ; tâtonnement outillage pur 1,9 % ; allowlist lean-ctx = 19,5 % de toutes les erreurs corpus (182 212 appels).
- Cycles codeur⇄juge : ~2,7/ticket ; causes en compte CODE 40 %/GROUNDING 20 %/DESIGN 19 % — mais grounding+design dominent le COÛT (3 pires : #1467 ~45 juges, #1465 4 designs, #1411 P1 rendu jeté). Le juge de design AVANT code transforme la refonte en amendement.
- Épiques : 41 cases sur 12 épiques, 0 cochée ; pathologies = salve d'ouverture (#665 : 34 enfants en 26 s), pivot silencieux (#1348, #942), capture (#834 exécutée sous #1318). Survivent celles au commentaire de pilotage réécrit chaque session (#1463, #1318).
- Restes : 36 % des fermetures émettent des restes, résorbés 19-24 % (« réserve » : 17/0) ; #1580 fermé <24 h avec ~7 enfants. **« Le workflow ferme les tickets, pas le travail »** — c'était l'application littérale du §2 de [[feedback-regle-1-jamais-commit-avec-reste-ouvert]] (contradiction interne, tranchée le 2026-08-30 dans la fiche).
- Cartes : programme EDO faux sur 5/6 affirmations, 26/40 plans jamais purgés (docs:check exclut docs/plans/), .wt-1501 = 67 commits non fusionnés.

**Régime adopté** (détail : skill `orchestrer-des-agents`, sections « audit 2026-08-30 ») : fan-out ≤1 + reste rattaché à une vague nommée + LIVRÉ=soldé + zéro net par vague · épique sans salve/sans checklist, pilotage au commentaire, compteur décroissant · lots 10-12, 2 fronts, validations asynchrones, mix par fenêtre de présence, checkpoint quota · ré-instruction avant dispatch des tickets >30 j · sortie runner → fichier.

**Exécution** : #1591 (boucle interne typecheck:fast/allowlist), #1592 (purge docs/plans + garde). #1593 DÉPILÉ le 2026-08-30 même — 11 arbitrages utilisateur rendus (via AskUserQuestion, consignés verbatim+date sur chaque ticket) : #665 EDO reprise (ré-instruction d'abord), #834 et #1361 gelés (label `gelée` créé), #211 reprise 1 système/vague en présence, #1348/#1350 retour maquette, #903 vague en absence, #1122 capturé par #1388 et FERMÉ, #942 re-cadrage DoD par lecteur, .wt-1501 reprise-fusion (ancré #1501), 5 restes dormants en tête de vague domaine, purge des worktrees agent-* au rituel d'ouverture. Canari trié (4 doublons fermés, #1493 seul ouvert). Cibles : delta net ≤0 sous 4 semaines, ≥50 % des fermetures dépilant du stock >28 j, résorption des restes ≥60 % sous 2 semaines.
