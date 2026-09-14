---
name: user-doctrine-format-unifie-reextraction-permise
description: "Toutes les extractions de Source/ ont UN format ; un livre hors format se RÉ-EXTRAIT (clause « un livre en service ne se ré-extrait plus » de #1388 §2.1 levée le 2026-09-14)"
metadata:
  node_type: memory
  type: user
---

Verbatim utilisateur (2026-09-14, épique #1388, Lot B) : « Il faut un format unifié pour toutes les extractions, donc s'il faut rééxtraire, on rééxtrait »

**Why:** les 16 livres FR ont été extraits à des dates et avec des chaînes différentes (en-têtes `*Folio 3+*` vs `*Pages PDF 10-23*`, AU1 sans aucune ancre de folio, tables encodées différemment) ; corriger à la main un livre hors format, c'est entretenir N formats — l'objectif est UN format, celui du pipeline documenté (`docs/ajouter-un-livre-source.md`, Marker paginé + découpeur câblé à `nomAscii`).

**How to apply:** avant de corriger un chapitre à la main, vérifier que son livre est au format canonique ; sinon, ré-extraction du livre (session qui tient Marker, en série, sous `Source/_marker/`), puis `reanchor --apply --remap` + `reparer-adresses` + stocks régénérés dans le même commit ; la correction manuelle au PDF ne porte que sur le résidu que la chaîne canonique ne sait pas produire.
