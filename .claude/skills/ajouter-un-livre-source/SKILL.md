---
name: ajouter-un-livre-source
description: À utiliser quand on intègre un nouveau livre ou supplément WFRP (PDF → Source/ → Atlas → données), quand une abréviation de livre inconnue apparaît dans une réf, ou avant de citer un livre absent de docs/sources-vf.md.
---

# Ajouter un livre source

Lire **`docs/ajouter-un-livre-source.md`** — pipeline complet : extraction Marker, découpe en
chapitres `Source/<Livre>/NN - Titre.md`, enregistrement dans `scripts/raw/_lib.mjs` (BOOKS),
intégration Atlas `docs/raw/`, curation MANUELLE de la donnée taguée `source` (build:data est
retiré), gardes `coverage.mjs`/`reconcile.mjs`. ⚠ Seuls les livres FR autorisés (règle stricte 1) ;
les PDFs sont faillibles — vérifier cas par cas.
