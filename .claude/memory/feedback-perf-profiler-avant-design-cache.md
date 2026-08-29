---
name: feedback-perf-profiler-avant-design-cache
description: "Perf de suite/garde — profiler l'ÉTAPE qui coûte (walk/parse/visite/ctor) avant tout design de cache partagé ; précédent 2026-08-23 où « 250 s de re-parse » valait 1,35 s"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ba0a846d-5585-40fc-9d7f-ac595de92162
  modified: 2026-08-23T08:57:39.891Z
---

Un chantier perf commence par un PROFIL PAR ÉTAPE (sonde chronométrée : énumération / lecture /
parse / visite / constructeur), jamais par un design déduit de la forme du code.

**Why :** 2026-08-23, suite à 4 min. J'ai attribué ~250 s CPU au « re-parse de `src/**` par
chaque garde » (11 walkers `readdirSync` vus au grounding) et proposé un corpus AST partagé
(`sourceCorpus.mjs`). Le juge a MESURÉ : parse complet du corpus = 1,35 s, 8 passes sans cache =
8,6 s — le temps était dans la logique de visite propre à chaque garde, et le cache par chemin
aurait été FAUX (fixtures TDD qui usurpent de vrais chemins, TS/TSX forcés divergents sur 4
fichiers, SourceFiles mutés par `ts.createProgram`). À l'inverse, le vrai gisement (`quad-couture`
151 s → 12,7 s) était un CONSTRUCTEUR (`new Resvg(..., loadSystemFonts: true)` = 122 ms par
instanciation, 97 % du coût) — invisible sans sonde ctor/render séparée.

Même jour, même classe, seconde fois : simulation LPT de l'ordonnancement (« 124 → 49 s de mur ») →
séquenceur par durées committées livré, mesuré A/B alterné = **−5 %** (workers CPU-bound en
contention, deux vagues node→jsdom séquentielles avec 15 s de trou mort, setup de 8,2 s payé PAR
worker — rien de cela n'est dans un modèle de durées). Retiré avant commit : sa garde rougissait
l'arbre partagé dès qu'un voisin supprimait un test. Un modèle d'ordonnancement se mesure en A/B
alterné (la machine dérive de +15 % sur 4 runs) avant d'être promis.

**How to apply :** (1) mesurer la suite en JSON (`vitest run --reporter=json`), trier par fichier ;
(2) sur chaque fichier lourd, sonde par étape AVANT de nommer la cause ; (3) toute hypothèse de
cause s'écrit « à réfuter » dans le brief du codeur, avec sa sonde discriminante ; (4) un cache
partagé inter-gardes exige une clé `(fileName, texte, options)` et deux pools (AST syntaxique vs
SourceFiles d'un Program) — sinon préférer la mémoïsation INTRA-fichier, paresseuse (jamais
top-level : payée à la collecte vitest). Lié : [[feedback-preuve-mesuree-sur-le-chemin-reel]],
[[feedback-mes-propres-sondes-se-remesurent]], [[env-charge-machine-un-seul-agent-lourd]].
