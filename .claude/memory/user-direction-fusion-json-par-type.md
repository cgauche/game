---
name: user-direction-fusion-json-par-type
description: "Direction user (2026-09-01) — à terme, FUSIONNER les .json de systèmes similaires en une collection avec un discriminant `type`, plutôt que N fichiers à def recopiée ; oriente la vague `table` (#1669) et toute résorption de divergence #1463"
metadata: 
  node_type: memory
  type: user
  originSessionId: 39a8970a-cba9-474a-be43-12bdf0b366e7
  modified: 2026-09-01T17:51:11.935Z
---

Verbatim user (2026-09-01, pendant la revue du concept `table` — 9 fichiers mono-table `config` à côté de `tables.json` qui porte déjà 20 tables `{id,type,label,die,rows,source}`) : « Si a terme on peu fusionner des .json et juste rajouter un "type" pour des systèmes similaires ».

Formulé au conditionnel (« si à terme on peut ») : c'est une DIRECTION cible, pas un ordre daté — le *quoi dans quoi* se tranche à la revue avec les faits (#1669), le *si* est acquis.

**Why** : N fichiers pour N instances d'un même système = N defs qui recopient l'enveloppe, N lecteurs « le fichier », N graphies — la divergence par manque de rigueur que #1463 résorbe (fiche [[feedback-finalite-1463-mutualiser-les-divergences]]). Une collection à `type` = une def, une enveloppe, un lecteur par id (patron existant : `miscastRoot`/`miscastEntries`, `src/data/overrides.ts:113-120`), un seul endroit d'édition au Codex.

**How to apply** :
- Devant « système similaire en N fichiers » (tables de tirage, criticals par localisation, tables de météo/mutations…), la cible par défaut est la FUSION dans la collection existante la plus peuplée (ex. `tables.json`) + discriminant `type`, jamais une Nᵉ option de fabrique par fichier.
- Ce qu'une fusion doit instruire : la charge des rangées diffère par `type` (`outcome`, `wounds`, `mount`, `ops`…) → union discriminée par `type` ou charge générique `ops` (à mesurer sur les rangées réelles) ; `source` par table ; `die` authoré par table (#1667) ; lecteurs migrés vers « table par id » ; migration rejouable datée, cardinal asserté sur le RÉSULTAT ; Codex/éditeur vérifiés.
- Un train de socle (fabrique qui pose l'enveloppe) n'est pas contraire à la fusion : il la prépare. Ne pas l'invoquer comme excuse pour repousser la fusion.
Liens : [[feedback-finalite-1463-mutualiser-les-divergences]], [[feedback-jamais-de-demi-migration]], [[game-vague-de-stock-lecons-2026-09-01]].
