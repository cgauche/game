---
name: feedback-tests-tombale-contrat-positif
description: "Un test qui affirme l'ABSENCE d'un élément retiré = pierre tombale (règle 6c étendue aux tests) — la forme saine est le contrat structurel POSITIF ou l'absence-RÈGLE de classe"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fe239011-bf46-4e5d-b120-539f4c477f25
---

Question user (2026-07-17, chantier fiche #492) : « les tests unitaires qui vérifient qu'on a
retiré un élément de l'interface (tombstone), c'est normal ? » — Non.

**Pourquoi** : la règle 6c (CLAUDE.md) interdit le commentaire-pierre-tombale parce que git porte
l'histoire. Un test `expect(html).not.toContain('equip-doll')` est le même poison en exécutable :
il commémore une suppression (keyé sur les classes MORTES d'une implémentation défunte), ne teste
aucun comportement, et cassera pour rien quand un design légitime réoccupera la place.

**Comment l'appliquer** :
- Absence-RÈGLE = légitime : l'absence est un invariant PERMANENT de classe (« zéro bouton par
  rangée non élue », « aucune réf livre hors Codex », « onglet sans objet ABSENT, jamais grisé »).
- Verrouiller un arbitrage user contre la régression d'un agent = contrat structurel **POSITIF**
  (« l'aside contient EXACTEMENT : cadre, nom, identité, barres, alarmes, Soins ») — même
  protection, sens permanent, zéro mémorial. Jamais une liste de noms de classes défuntes.
- À la revue d'un rendu d'agent : toute assertion `not.toContain(<classe/élément retiré ce jour>)`
  se convertit dans le geste. Le retrait lui-même est déjà gardé par les cliquets de classes + git.
