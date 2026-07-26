---
name: game-campagne-json-portable-frontiere-reference-narratif
description: "Une campagne = JSON PORTABLE auto-suffisant, échangeable/intégrable en local ; frontière RÉFÉRENCE (règle globale, feuilletable) vs NARRATIF (embarqué dans le JSON, révélé seulement, jamais au Compendium). Gouverne #670/#671 et tout le contenu de l'épique EDO."
metadata: 
  node_type: memory
  type: project
  originSessionId: 5ac67016-6d97-47c6-b4b9-ae151b432123
  modified: 2026-07-22T10:37:43.224Z
---

**Directive utilisateur (2026-07-22, verbatim)** : « Les campagne sont éditable et on doit
pouvoir échanger un fichier json pour l'intégrer en local, ne l'oublie pas ».
Surgie en soldant #670 (carnet d'enquête) : l'utilisateur a réfuté coup sur coup un `src/data/clues.json`
GLOBAL — « le codex va afficher toutes les rumeurs de toutes les campagnes aux joueurs ? Même ceux que
l'on a pas découverte ? » puis « tous les grands méchants de la campagne seront visible a l'avance ? ».

## La frontière (test : « pareil dans TOUTE campagne, ou propre à CETTE histoire ? »)

| RÉFÉRENCE (règle — global `src/data`, feuilletable au Compendium) | NARRATIF DE CAMPAGNE (histoire — DANS le JSON de campagne, révélé seulement) |
|---|---|
| Créatures **génériques** (Homme-bête, Gobelin, Rat géant), sorts, prières, familles d'armes/armures, qualités, talents, carrières, races | **Méchants NOMMÉS** + leurs statblocks uniques, **indices/rumeurs**, documents d'intrigue, dialogues, scènes, carte du monde |
| Identique partout → pas un spoiler ; **référencé par id** (le destinataire a le même livre) | Propre à cette histoire → spoiler ; **embarqué dans le JSON** (voyage avec la campagne) |

Un méchant nommé (« Etelka, meneuse du culte ») = base générique **par id** (`homme-bete`) **+ surcharges de
campagne EMBARQUÉES** dans le JSON. L'instance nommée est du narratif, jamais une entrée du bestiaire global.

## Deux invariants indissociables

1. **Portabilité** : le JSON de campagne est AUTO-SUFFISANT (embarque tout son narratif) et RÉFÉRENCE la
   règle partagée par id. Contenu de campagne dans `src/data/` global = NON portable (ne voyage pas à l'export)
   ET fuite au Compendium — double faute.
2. **Anti-spoiler** : le Compendium/bestiaire joueur n'affiche que la RÉFÉRENCE + le DÉCOUVERT (gaté par la
   rencontre). Le narratif non révélé n'existe nulle part côté joueur. La SEULE fenêtre sur les indices = le
   Carnet, qui ne montre que `state.clues` (statut révélé persisté).

## Conséquences actées

- **#670 indices/rumeurs** : définitions PORTÉES PAR LE PROJET de campagne (patron des dialogues, règle 2 du
  CLAUDE.md « contenu de campagne = donnée éditable dans l'éditeur »), PAS `src/data/clues.json` global.
  Édités dans l'éditeur de campagne (contexte AUTEUR), jamais au Compendium. Carnet = seule fenêtre joueur.
  Les Effects `revealClue`/`discreditClue`, l'état `state.clues` (statut révélé), la save v15 sont bons ; les
  DÉFINITIONS vivent dans le narratif de campagne (`src/state/campaignNarratif.ts` : `interface Indice`, champ
  `indices`, aux côtés d'`affaires`/`presetsPnj`/`objets`), jamais dans un `src/data/*.json` global —
  `src/state/clues.ts` n'y porte QUE l'état runtime et importe son type de là.
- **#671 presets PNJ** : registre DE CAMPAGNE, pas global-feuilletable ; méchants nommés = statblocks embarqués
  sur bases globales par id ; apparition GATÉE PAR LA RENCONTRE (jamais un catalogue d'avance).

Voir [[game-campagne-edo-programme]] (l'épique #665), règle 2 du CLAUDE.md (schéma de Scène éditable).
