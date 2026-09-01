---
name: feedback-epic-ne-se-ferme-jamais-sur-tickets-ouverts
description: "User 2026-09-01 : un épic ne se ferme JAMAIS « sur ticket ouvert » — proposer une clôture portée par des restes = proposer une demi-migration ; l'objectif suivant (#1388) ne justifie jamais de raccourcir le DoD"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 39a8970a-cba9-474a-be43-12bdf0b366e7
  modified: 2026-09-01T13:00:42.481Z
---

Vécu 2026-09-01 (clôture #1463) : le grand juge rend « FERMABLE SOUS DÉCISION » avec 3 clauses portées
par des tickets ouverts (#1654 AST 71→0, #1620 détecteur à 56 % de FN, #1657 concept `test` sans forme
cible). J'ai posé les 3 décisions à l'utilisateur en marquant « (Recommandé) » l'option « fermer l'épic
sur ticket ouvert / requalifier la clause / après #1388 » — au motif de l'objectif macro (la part joueur).
L'utilisateur a choisi l'inverse sur les trois et a dit : « Pas de demi-migration j'ai dit, ça sert à
quoi si on ferme l'épique sans avoir terminé ? »

**Pourquoi :** sa doctrine est explicite et antérieure ([[feedback-jamais-de-demi-migration]],
[[feedback-regle-1-jamais-commit-avec-reste-ouvert]], [[feedback-migrer-l-existant-listes-doivent-decroitre]]) :
un DoD se tient MOT À MOT, une liste décroît jusqu'à ZÉRO, un reste routé en ticket n'est pas un solde.
« Fermer en portant » = fermer sans avoir fini — l'épic « un concept = une structure » avec 71
redéclarations n'est pas un concept = une structure. L'objectif suivant (#1388) est une PRIORITÉ de
séquencement, jamais une raison de raccourcir le DoD courant.

**Comment appliquer :**
- Ne JAMAIS recommander une clôture d'épic/ticket dont une clause du DoD est « portée » par un ticket
  ouvert ; si la question doit être posée, l'option conforme à la doctrine est la seule « recommandée »,
  et la question porte sur le SÉQUENCEMENT (quoi d'abord), pas sur la clôture.
- Un grand juge « FERMABLE SOUS DÉCISION » se lit « NON FERMABLE — voici les chantiers restants ».
- La séquence après une telle passe = les chantiers porteurs (ici #1657 → #1620 (ii)/(iii) → #1654),
  puis un NOUVEAU grand juge, puis seulement l'objectif suivant.
