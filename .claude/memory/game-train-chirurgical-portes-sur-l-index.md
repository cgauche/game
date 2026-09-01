---
name: game-train-chirurgical-portes-sur-l-index
description: "Train chirurgical (staging par pathspec/hunks) : les portes de vérité se jouent sur l'INDEX (checkout-index), jamais sur l'arbre — 3 demi-trains en 2 jours par classement PAR NOM + tsc-sur-arbre"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 39a8970a-cba9-474a-be43-12bdf0b366e7
  modified: 2026-09-01T02:20:35.998Z
---

Vécu 2026-08-31→09-01, TROIS occurrences de la même classe en 2 jours (épic #1463) :
1. #1552 : 10 fixtures `type:'scene'` oubliées au staging → CI rouge TS2741 (complément 0b84a5aa8).
2. #1552 : doc CI re-addé version ARBRE après un refus de hook qui avait désempilé (507e329a8).
3. #1553 : les 2 `.d.mts` (déclarations des libs .mjs du lot) classés « WIP voisin » PAR NOM →
   demi-train c21f2bf3d, CI rouge (loadCategoryBooks/ENTITY_ORPHAN_FAMILIES absents), attrapé par
   la session voisine au run 33461938126, complément f7c53474a.

**Pourquoi :** sur un arbre PARTAGÉ churné, le commit est un SOUS-ENSEMBLE de l'arbre. `npm run
typecheck` vert avant commit prouve l'ARBRE (qui porte encore les fichiers oubliés), jamais le
COMMIT. Et un fichier `M` ne se classe JAMAIS par son nom/dossier (« scripts/guards = la voisine ») :
un `.d.mts` adjacent à MES .mjs était à moi. Deux biais qui se composent : le tsc-sur-arbre masque
exactement ce que le classement-par-nom exclut.

**Comment appliquer :**
- Tout fichier `M` se classe par `git diff` LU (le contenu dit son train), jamais par nom — et un
  lot qui touche un `.mjs` typé embarque son `.d.mts`, comme un bump de schéma emporte ses tests.
- Avant un commit chirurgical à risque (test .ts + libs, schéma + fixtures) : porte de vérité sur
  l'INDEX — `git checkout-index --prefix` vers un temp (+ `git init` jetable, cf. le piège
  rev-parse qui remonte à l'arbre) et y rejouer tsc/le test concerné. À défaut, sonde minimale :
  `git diff --name-only` de l'arbre ∩ imports du lot = vide.
- Lien : [[feedback-attribution-rouge-suite-sonde-arbre-committe]] (l'attribution d'un rouge exige
  l'état committé — même racine : l'arbre ment dans les deux sens),
  [[game-stage-chirurgical-hunk-arbre-partage]].
