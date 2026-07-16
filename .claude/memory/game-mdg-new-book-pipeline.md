---
name: game-mdg-new-book-pipeline
description: "Ajouter un nouveau livre à l'Atlas (Marker→split→register→workflow→apply) — fait pour Mer des Griffes"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5bf69c7c-47c1-4504-aa51-629b7fa83e34
---

**La Mer des Griffes** (*Sea of Claws*, abrév **MDG**) = **15e livre** intégré à l'Atlas le 2026-06-22
(commits `295f9a40` ré-extraction Source + `819de62d` MDG, poussés sur `feat/wfrp4-rpg-foundation`).
Cadre côtier (gazetteer) + grosses **règles navales** (combat naval, navires/artillerie, navigation,
carrières Côtier, cultes Manann/Stromfels, magie des mers, bestiaire marin).

**RUNBOOK « ajouter un livre à l'Atlas »** (réutilisable) :
1. **Marker** : `marker_single "<pdf>" --output_format markdown --config_json scripts/raw/marker-paginate.json
   --disable_ocr --output_dir "Source/_marker/full/<dir>" --disable_image_extraction` (lourd, ~45 min ;
   lancer en arrière-plan). PDF gitignoré, `_marker/` non committé.
2. **Split** : `marker-split.mjs` exige une structure ANCIENNE → INUTILISABLE pour un livre neuf. Écrire un
   splitter par les titres du SOMMAIRE (`scripts/raw/split-mdg.mjs` : liste ordonnée des en-têtes majeurs,
   match séquentiel `#…`, page PDF via dernier `{N}----`+1) → `Source/<dir>/NN - Titre.md` + `00 - Index.md`.
3. **Register** : ajouter à `BOOKS` (`scripts/raw/_lib.mjs`), `docs/raw/sources.md` (table + compte),
   `CLAUDE.md` (§ Sources VF + abrév). Chapitres de CADRE (gazetteer) → ajouter à `HORS_REGLE` de `coverage.mjs`.
4. **Workflow** (opt-in « ultracode ») : un agent par domaine touché, `extract→verify` adversarial (la vérif
   reconfronte chaque réf/citation à la source — indispensable, cf. fabrications de [[game-atlas-reanchor-epreuve]]).
   Renvoie ficheTopics/catalogueEntries/sommaire par domaine (le script workflow n'a pas d'accès fs).
5. **Apply** : `scripts/raw/apply-mdg.mjs` (lit le JSON `result` du fichier de sortie du workflow) insère
   topics+sommaire dans les fiches et entrées dans les catalogues, **idempotent** via sentinel `<!-- MDG-INTEGRATION -->`.
6. **Vérif** : `reanchor.mjs --apply` (PAS `--remap` tant que la Source n'est pas committée — re-décalerait les
   réfs LDB) vérifie mécaniquement les citations `MDG NN l.X` (résultat MDG : 51 citations, 0 dérive) ;
   puis `coverage` (⬜0) + `reconcile`.

Gotcha : sortie git compressée par le hook lean-ctx (compte faux) → dumper `git show --name-only` dans un
fichier et le Read pour vérifier le périmètre d'un commit. CRLF→LF sur catalogues/chapitres = warning cosmétique.
Étend [[game-atlas-raw-doc]].
