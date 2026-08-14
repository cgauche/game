---
name: game-refs-raw-convention-prefixe-fichier
description: "Réfs RAW : acronyme canonique unique (source = books.json) + numéro de FICHIER disque, jamais le chapitre imprimé"
metadata:
  node_type: memory
  type: project
  originSessionId: 6dda9f10-baee-4f9e-b534-2933d9905a34
  modified: 2026-07-18T20:25:56.017Z
---

**Une réf RAW s'écrit `ABBR N l.X`** où `N` = le **préfixe de FICHIER disque** (`NN - `), PAS le chapitre imprimé — c'est ce que résout `chapterFile` (`scripts/raw/_lib.mjs`). Offsets mesurés : **MSRC (ex-T2C) = +2 constant** (fichier 03=CH1 … 19=CH17) ; **EDOC = variable +2..+4** (03=CH1, 05=CH2, 07=CH4, 08=CH5, 13=CH9, 16=CH12 ; **04 et 09 = artefacts `_GoBack`**, pas des chapitres) ; MSR (ex-T2) = +2 ; EDO, PDT (ex-T3), LDB = alignés.

**SOURCE UNIQUE des acronymes (#585, origin 997188dd)** : `src/data/books.json` est LA source — un champ `abbr` (29 livres) + `dir` (chemin `Source/` des 16 extraits, VDM compris). `abbr` est le SEUL champ d'acronyme — pas de second champ (`abr`…) à côté. `BOOKS` (`_lib.mjs`) et `folioIntegrity.BOOK_ABBR_BY_ID` en **DÉRIVENT** — plus aucune table à synchroniser à la main. **Ajouter un livre = éditer books.json SEUL.**

**ZÉRO variance** : `EXTRA_ABBR_VARIANTS` supprimé, `bookOf` en identité stricte — une seule graphie par livre, toute autre = abréviation INCONNUE (échec nominatif de `citation-graphy-guard`). Les graphies gelées : `ABBR N l.X` (pas de `ch.`, pas de zéro de tête), folio `ABBR N p.X` (chapitre obligatoire).

**Acronymes = acronymes de TITRE** (arbitrage user 2026-07-18) : `MSRC`/`MSR`/`PDT` (ex-T2C/T2/T3 — le commit fondateur 09b30a7b avait recopié le préfixe de DOSSIER `2.0 Mort sur le Reik`→`T2` au lieu du titre), `NADJ` (ex-NADJ, le A ne correspond à aucun mot), `MCLB` (ex-Middenheim), `AU1` (ex-Ubersreik), `ADE I`/`ADE II` en romain. Les `dir` gardent le nom PHYSIQUE réel du dossier (typos `Aldorf`, `Mer de Griffe`) ; seuls les `label` sont propres.

⚠ **Pièges de sweep d'acronymes** : `Savoir (Middenheim NN)` = valeur de COMPÉTENCE dans les statblocs (jamais renommer) ; `#T2`/`#T3` = jalons de PROJET ; « Ubersreik 8 » en ligne de survey = un COMPTE. Et une réf au mauvais chapitre peut tomber DANS LES BORNES (statbloc au lieu de la règle) — invisible des gardes : **seul un fan-out de juges au Source le voit** (2 ancres fausses sur 37 attrapées ainsi, #585 Lot C). ⚠ Workflow : `args` avec gros objet imbriqué arrive `undefined` → inliner les données dans le script.

**Cliquet de graphie** (`scripts/raw/graphy-baseline.json`) : `chDot`, `bareFolio` et `bookNoChapterSrc` sont à **0** — plus aucune violation gelée, toute nouvelle occurrence échoue nominativement. Seule famille encore gelée : `chapterBoundaryFolio` — **48 au total** (mesuré 2026-07-26), dont **34 sous `src/`** et **14 sous `docs/raw/`**. Voir aussi [[game-atlas-raw-doc]], #586 (borne haute), #456 (_GoBack).
