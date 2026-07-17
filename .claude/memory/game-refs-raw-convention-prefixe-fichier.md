---
name: game-refs-raw-convention-prefixe-fichier
description: "Convention des réfs RAW = numéro de FICHIER disque (préfixe NN -), JAMAIS le chapitre imprimé — T2C +2, EDOC variable, artefacts _GoBack intercalés"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6dda9f10-baee-4f9e-b534-2933d9905a34
---

**Toute réf `LIVRE N l.X` cite le PRÉFIXE DE FICHIER disque (`NN - `), pas le chapitre imprimé** — c'est ce que résout `chapterFile` (`scripts/raw/_lib.mjs`), et `ch.` est purement cosmétique pour le parseur. Établi et purgé le 2026-07-17 (#583/#526, commits 2ed2acff + a5eddf80, ~315 réfs ré-ancrées au texte).

Offsets mesurés : **T2C = +2 constant** (fichier 03=CH1 … 19=CH17 ; fichier 16 = CH14 maladies d'eau) ; **EDOC = variable +2..+4** (03=CH1, 05=CH2, 06=CH3, 07=CH4, 08=CH5, 10=CH6 … 16=CH12 ; 04 et 09 = artefacts non-chapitres type `_GoBack`) ; T2 = +2 ; EDO (T1), T3, LDB = alignés.

**Pièges** : une réf en chapitre imprimé peut tomber DANS LES BORNES du mauvais fichier (statbloc de PNJ au lieu de la règle) — invisible de `check-code-refs`/`check-refs` par construction ; seule la lecture AU TEXTE tranche. La prévention de classe vit dans [[game-atlas-raw-doc]] et les tickets #585 (graphie gelée + abréviations canoniques : MSLRC/MSRC/T2C et NADJ/NADAJ coexistent), #586 (reconcile borne haute), #522 (ancres folio), #456 (_GoBack).
