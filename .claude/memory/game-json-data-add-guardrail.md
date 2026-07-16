---
name: game-json-data-add-guardrail
description: "Avant d'ajouter un élément à un src/data/*.json — vérifier qu'il n'existe pas déjà (tout sous-système), chaque champ vs source ET voisins, zéro déviation RAW silencieuse"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3b2e71b4-5c3c-476f-8d8d-10331bd73755
---

Ajouter une entrée dans un `src/data/*.json` (ou déléguer à un agent) exige un garde-fou STRICT.
Incident 2026-07-06 (#148 Bélier) : un agent a « totalement dévié » — l'utilisateur était très mécontent.

**SYSTÈME LIVRÉ 2026-07-06 (`801c4b0c`)** en 3 couches : (1) atlas `docs/donnees.md` (carte des 94
`src/data/*.json` + conventions de champs + pièges d'homonymes) + garde `src/data/data-atlas-complete.test.ts` ;
(2) skill **`ajouter-une-donnee`** (routeur → skills de domaine) + `docs/ajouter-une-donnee.md` ;
(3) hook `scripts/hooks/data-edit-guard.mjs` (check-first advisory sur toute écriture `src/data/*.json` —
atteint les SOUS-AGENTS, où les skills ne se déclenchent pas) + checklist de brief (`docs/donnees.md` §E).
Insight clé : un skill seul n'aurait rien changé (sous-agent). La dup sémantique d'un homonyme (Bélier ×6)
n'est PAS attrapable par une garde (`id-collisions` autorise les homonymes) → défense = découverte + hook.

**Les 5 dérives à empêcher** (déroulé obligatoire) :
1. **DOUBLON** : le Bélier existait déjà dans `mass-battle.json` (table « Machines de guerre » ADE II
   curée en entier) → grep l'id ET le label ET le concept dans **TOUT** `src/data/*.json` AVANT d'ajouter.
   Un concept traverse plusieurs sous-systèmes (bélier = mass-battle / naval-traits / qualities / spells).
2. **Mauvais fichier** : une machine de guerre va dans `mass-battle.json`, PAS `trappings.json` (équipement
   porté). Il manque une doc « où va chaque type d'élément » — la construire/consulter avant de choisir.
3. **Champ mal lu** : l'agent a pris la colonne « Équipe » (servants=6) pour « Encombrement ». Vérifier
   chaque champ contre l'**en-tête du tableau** source ET contre 2-3 entrées voisines.
4. **Source fausse** : `book:"ADE II"` alors que la convention data est `"ADE2"` (12 voisins) ; `page`
   déduite d'un `<span id="page-N">` Marker **NON fiable** (l'utilisateur l'a confirmé). `book`/`page` se
   copient de la convention des voisins ; les ancres span-id ne donnent PAS la vraie page.
5. **Déviation RAW silencieuse** : l'agent a auto-admis « Test de Force non modélisé, hors scope ». INTERDIT :
   RAW non modélisable → issue gabarit #101+ ou valeur maison taguée, jamais « hors scope » enterré.

**Why:** un doublon de données = deux sources de vérité (credo : zéro doublon) ; un champ mal lu/mal sourcé
se propage ; une déviation RAW enterrée est de la dette invisible.

**How to apply:** pour tout ajout de donnée (moi ou un agent délégué), coller `docs/donnees.md` §E dans le
brief : check-first (grep tout `src/data/`) → bon fichier (carte §A) → source RAW (en-tête inclus, réf
`<LIVRE> <chap> l.<ligne>`) → chaque champ = source ⊕ voisins → zéro invention/déviation → **canonicaliser via
`serializeDataset`** (`src/data/serialize.ts`), JAMAIS un `JSON.stringify(...,2)` maison (risque de casser
`serialize.test` byte-exact) + gardes verts. Vérifier DUR le rendu d'un agent (relire la source moi-même).
Voir [[feedback-deleguer-grounding-pas-que-code]], [[credo-exemples-calibrants]],
[[game-codex-editable-json-free]] (toute donnée doit être éditable au Codex).
