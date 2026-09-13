---
name: game-doctrine-une-entite-n-livres-n-variantes
description: "Une entité définie dans plusieurs livres reste UNE entrée : N emplacements (livre, folio) + N variantes gatées par la règle optionnelle, jamais deux entités"
metadata:
  node_type: memory
  type: project
---

Doctrine utilisateur (2026-07-17, verbatim) : « presque tous les objets […] peuvent se trouvé défini dans plusieurs livres […] Mais jamais ca ne sera 2 talents différents. Par contre il faut gérer l'ensemble des cas: bien référencer l'ensemble des livres et pages, gérer les régles alternatives en cas d'activation de régle optionnelle »

**Why:** le multi-livres est la norme (variante conditionnée à une règle optionnelle, précision, ou republication pure) ; indexer la variante sur le LIVRE au lieu du MODULE DE RÈGLES produit des doublons et des règles fausses.

**How to apply:** une entrée porte N emplacements `(livre, folio)` et N variantes, chacune gatée par SA règle optionnelle — jamais par son livre d'origine. Chaque variante porte SON texte verbatim et SA réf (règle 5), sinon la forme multi-source blanchit deux proses différentes sous une desc unique.
