---
name: game-chantier-source-unique-1388
description: "CHANTIER #1388 « Un texte, trois fenêtres » : Source/ corrigé = unique dépôt de prose, fiches = découpes adressées, liage arbitré par occurrence — l'épique fait foi, spike prouvé scripts/source/"
metadata:
  node_type: memory
  type: project
  originSessionId: a53be216-13bd-50b8-a531-a659a06d6881
---

**L'épique #1388 fait foi** (autoportante : arbitrages verbatim, mesures, conditions de juge, lots
#1389/#1384/#1390/#1391/#1392/#1393). Instruite le 2026-08-18 (2 lecteurs, 2 juges adversariaux, spike
prouvé par mutation — `scripts/source/decoupe.mjs` + `derive-decoupes.mjs` + 14 tests dans `test:raw`,
commits `e35bd8a`/`c4568c4` sur `claude/source-content-deduplication-yo7jyh`, À RAPATRIER sur main).

Arbitrages structurants (verbatims à l'épique) :
- **Zéro duplication de prose** : fiche = DÉCOUPE `{book, ch, sec, secOcc, b0, b1, sum}` ; valeur de
  tableau = CELLULE `{row, col}` par CLÉ jamais par indice ; empreinte `sum` vérifiée à CHAQUE résolution
  (une correction du Source casse BRUYAMMENT, réparation dirigée par match de contenu).
- **Source/ = édition de travail** : Marker importe UNE fois, un livre en service ne se ré-extrait plus
  jamais — il se corrige à la main (vérif PDF/folio). Corollaire : `reanchor --apply --remap` à CHAQUE
  réparation de chapitre (l'impact réfs `l.X` est chiffré à l'épique §5bis).
- **Liage** : rien de flou ne se lie automatiquement — arbitrage humain PAR OCCURRENCE (donnée sur
  l'entrée, au clic), politiques par label = simples pré-remplissages. Les listes en dur de `relations.ts`
  (PRIORITY_CAT_ORDER l.359, SAME_CONCEPT_GROUPS) migrent en donnée (#1392).
- **Exceptions closes** : livres sans extraction (frenchy-bzh, 423 entrées) et prose maison, étiquetées.
  `gods` : curation à DÉFAIRE (blobs recomposés), jamais un modèle.
- **Diffusion ARBITRÉE** (2026-08-18, option choisie : « Tout servir, partout ») : les chapitres entiers
  des 16 livres extraits sont servis en déployé comme en local — exposition publique du texte intégral
  assumée par le propriétaire. Gate du lot D #1391 LEVÉ, repli §6 sans objet (consigné sur #1388 et #1391).

Leçon de méthode payée cher dans la session : un DESIGN en discussion ne se ticket pas (3 tickets créés
puis fermés not_planned #1383/#1386/#1387) — un FAIT mesuré se ticket, un design attend l'arbitrage puis
devient l'épique. Et le solde de gardes se CHIFFRE avant d'être promis (claim « négatif ou nul » réfuté par
inventaire : 2 gardes verbatim de famille seulement dans tout le dépôt).
