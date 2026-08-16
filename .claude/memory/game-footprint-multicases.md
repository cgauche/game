---
name: game-footprint-multicases
description: "Empreinte multi-cases des créatures par Taille (T6) — une grande créature occupe/remplit N×N tuiles partout (combat, exploration, éditeur)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 6a091869-bf82-4c57-9848-2d25a75eaedb
  modified: 2026-08-16T07:38:56.459Z
---

Sous-système **Footprint T6** (Jalon 1.5 Taille) LIVRÉ en 6 phases, branche `feat/wfrp4-rpg-foundation`. Règle canon : **NON figée** — LDB `15 - Déplacement.md` l.12 (« chaque case représentant une distance de 2 mètres dans le jeu […] Les créatures plus grandes peuvent occuper **2, 4 ou même plus de cases** sur la carte, en fonction de leur trait Taille (voir page 342) ») ; p.342 (`85`) n'a PAS de table par catégorie. Donc DESIGN ancré : **Grande 2×2** (= les « 4 cases » citées), **Énorme 3×3**, **Monstrueuse 4×4**, Minuscule→Moyenne 1×1.

**Convention d'ancrage** : `pos` = coin Nord-Ouest de l'empreinte, qui s'étend vers +x/+y. Une créature 1×1 garde `pos` = sa tuile → tout le code positionnel 1×1 reste correct par défaut (helpers à `foot=1` = comportement historique strict).

**Modules / API :**
- `src/state/footprint.ts` (pur) : `sizeFootprint(size)`→N, `footprintTiles(pos,size)`, `occupiesTile`, `footprintChebyshev` (distance min tuile-à-tuile entre empreintes), `footprintsOverlap`, `combatDistance(a,b)` (Chebyshev d'empreinte combattant-à-combattant ; un grand est « au contact » par n'importe quelle tuile).
- `src/gameIso/sizeScale.ts` (rendu) : `sizeTokenScale(size)` lit la table `SIZE_TOKEN_SCALE` — Grande ×1.45 / Énorme ×2.0 / Monstrueuse ×2.7, bas de gamme esthétique 0.45–0.78 (Minuscule 0.45 / TrèsPetite 0.6 / Petite 0.78, Moyenne = 1). Elle est ancrée sur les **proportions face à un humain**, PAS sur le remplissage de l'empreinte : l'empreinte N×N reste la vérité d'OCCUPATION, le visuel a le droit d'être plus petit qu'elle (un cheval bloque 2×2 sans mesurer 4 m au garrot).
- `state/spawn.ts` : `entitySize(ent)` (statbloc.size sinon Traits du statbloc/`ref`) pour le rendu hors combat.

**Câblage :** `occupied()` (combatFlow) = empreinte complète **relative au mover** — les combattants de Taille STRICTEMENT inférieure sont « dégagés du chemin », ne bloquent pas (LDB `85` l.308-309). `reachable`/`pathTo`/`fleeReachable` (path.ts) ont un param `foot` (l'empreinte doit RENTRER → pas de couloir d'1 tuile, pas de bord). `combatDistance` remplace `chebyshev(a.pos,b.pos)` aux 11 sites mêlée/portée/IA. Rendu : token **centré** (pos + (N-1)/2) et mis à l'échelle — depuis la voie volumique (#1176 ; `EntityToken` supprimé 2026-08-16), le centrage vit dans `sceneMeshes.actorBillboards` (offset `(sizeFootprint-1)/2` sur l'ancre). Picking combat via `occupiesTile` (clic d'une tuile → la créature).

**Reste (refinements, non bloquants) :** (a) **éditeur — POSE** : réserver N×N + aperçu d'empreinte au drag (logique `Editor.tsx`, laissée — refacto SceneEntity de l'autre session la cassait ; le *rendu* éditeur est fait). (b) **déplacer les plus petits** sur la case d'arrivée d'un grand (ils ne le bloquent déjà pas ; reste à les pousser au repos vs co-occuper). (c) **recette navigateur** visuelle (était bloquée par l'arbre rouge du refacto parallèle). Voir [[game-difficultes-combat-table]].
