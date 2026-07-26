---
name: game-rig-static-3-views-direction
description: "Direction rig : tout objet STATIQUE rendu par le rig (engin/navire/structure/objets) doit avoir un art DISTINCT par entité × 3 vues (face/profil/dos), en données (defs/registre) — comme les créatures. SAUF les armes (1 art, tournées dans le plan)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 03105508-1981-4187-b39c-23c39463ada6
---

Direction architecturale énoncée par l'user (2026-06-29, chantier engins de siège) pour le rendu rig des objets STATIQUES :

- **Cible** : chaque entité statique rig (engin de siège, **navire**, structure, « objets » à terme) a un art **DISTINCT par entité** ET **3 vues** (face / profil / dos), défini en **données** (1 fichier `defs/<id>.ts` → registre auto-chargé `gen-registry` → résolu PAR ID), rendu par la fondation partagée `groundedBody` (`staticBody.ts`). Exactement le modèle des **créatures** (apparence par espèce, pas de name-matcher).
- **Exception** : les **ARMES** restent 1 seul art (elles tournent dans le plan via le rig porteur — `RigHeldDef.art` unique). Cf. [[game-weapon-art-id-routing]], [[game-rig-2d-paper-doll]].
- **Le NAVIRE tient la cible** (`src/gameIso/rig/ship/composeShip.ts`) : 1 fichier `ship/defs/<id>.ts` par coque (**20 defs** — barge, caraque, cogue, galère de guerre, knarr, langskip…) → registre auto-chargé `SHIP_ARTS` → `HULL_ART_BY_ID` route PAR ID de `vehicles.json` (jamais un name-matcher) ; `resolveShip` CONSOMME la vue demandée via `pickView` puis `groundedBody`. Garde `ship-arts.test.ts` : les 20 coques sont toutes dessinées et chaque `profile()` est distinct.
- **L'ENGIN (post-2026-06-29) est la RÉFÉRENCE du bon pattern** : `engin/defs/<id>.ts` (`EnginArtDef {id, front, profile, back}`) → registre `ENGIN_ARTS` → `composeEngin` résout par id (plus de regex/name-matcher, plus de `Record` à la main).
- **La brique « corps statique orienté » est PARTAGÉE** : `pickView` (contrat d'art orienté, `rig/viewArt.ts:45`) + `orientedArtOr` (repli VISIBLE #223 quand un id n'a pas d'art dédié, l.80) + `groundedBody` (`rig/staticBody.ts`) — `composeEngin` comme `resolveShip` les composent, aucun n'a sa mécanique locale. Une 3ᵉ famille statique s'y branche, elle ne re-décrit ni la sélection de vue ni l'ancrage au sol. Cf. [[feedback-mutualiser-invariant-pas-juste-appel]], [[credo-exemples-calibrants]].

**Why** : le rig doit rendre chaque objet reconnaissable sous tous les angles iso, comme les créatures — un art unique servant toute une famille aplatit la lecture (deux coques différentes au même dessin), et une vue unique casse l'orientation iso.
**How to apply** : pour tout nouvel objet statique rig → art par id × 3 vues en `defs/` + registre auto-chargé (jamais inline générique ni name-matcher), monté sur les briques partagées `pickView`/`orientedArtOr`/`groundedBody` — un id sans art tombe sur le repli VISIBLE, jamais sur un générique silencieux. Cf. [[game-namematch-deleted]], [[game-creature-registry]], `docs/architecture.md` (direction visuelle).
