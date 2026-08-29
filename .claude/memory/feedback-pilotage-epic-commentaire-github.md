---
name: feedback-pilotage-epic-commentaire-github
description: "Le suivi d'un chantier vit en COMMENTAIRE DE PILOTAGE sur l'epic GitHub, tenu à jour à chaque transition de lot — jamais seulement dans un scratchpad volatile"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 581b89eb-a389-4f97-87c2-713104a0fbca
  modified: 2026-08-29T06:36:07.382Z
---

Question utilisateur (2026-08-29, verbatim) : « Tu n'as pas un fichier de suivis de ce que tu fais ? » — posée à la fin de L1b #1467, quand le seul suivi synthétique était un TODO de scratchpad (purgé DEUX fois par le système pendant la session, perdant au passage un design jugé).

**Why** : le scratchpad de session est volatile et invisible de l'utilisateur ; les commentaires par-lot du ticket sont durables mais éclatés ; la doctrine du dépôt refuse les fichiers de plan ([[feedback-pas-de-plan-superpowers-tickets-github]]). Le porteur juste du « où en est-on » est l'EPIC lui-même.

**How to apply** : sur tout chantier multi-lots, poser un **commentaire de PILOTAGE sur l'epic GitHub** (fait ✅ / arbitrages verbatim / séquence des restes avec propriétaires / renvoi au détail) et le RE-POSTER mis à jour à chaque transition de lot (un commentaire neuf, pas une édition silencieuse — le fil garde l'historique). Le TODO de scratchpad reste l'outil de travail fin de la session, jamais le suivi de référence. Précédent : https://github.com/cgauche/game/issues/1463#issuecomment-5460847516.
