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

**4e occurrence (2026-09-01, C1 #1457, e89a836d3) — classe VOISINE, pas un oubli de staging :** le lot a
posé le PREMIER `alsoIn` de `species.json` = une nouvelle SIGNATURE D'ENVELOPPE pour ce dataset ; la
famille structures (`structures-contrat`, `no-json-fields`, liste de champs `AlsoInField` de CodexEdit)
exigeait une ligne de stock L1d + `'races'` au picker. Mon juge (lentille RAW/données) et mes gates
(vitest de DOMAINE) ne couvraient pas cette famille → HEAD rouge pour tous pendant mon redémarrage,
soldé par la voisine (d53d75b15). **Règle :** un champ NEUF sur un dataset (même une valeur juste) est
un changement de FORME → jouer la famille structures avant commit, ou la suite COMPLÈTE (c'est
précisément ce qu'elle attrape et que les sous-ensembles « de domaine » ne voient jamais).

**5e occurrence (2026-09-01, B3 #1457, 687863ec6) — même classe FORME/COMPTE :** un dédoublonnage de
`skills[]` (riverain-respecte 27→26) sans rafraîchir le stock de COMPTE `slotsStock.mjs` (5982→5981) —
CI rouge attrapée par la voisine, corrigée dans SON train. Mes gates = 5 suites de domaine ciblées, pas
`slots-contrat`. **La règle n'est pas « jouer la bonne famille » (je ne la devine jamais toute) : c'est
la SUITE COMPLÈTE avant push d'un train de données, sérialisée s'il le faut** — les sous-ensembles sont
une porte de codeur, pas une porte de commit.
