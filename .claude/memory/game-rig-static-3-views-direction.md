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
- **Le NAVIRE est un POC** (`src/gameIso/rig/ship/composeShip.ts`) : `resolveShip` fait `void view` (1 seule vue) + UN art générique (coque + gréement paramétré par `hull.rig` avirons/voile/mixte) servant TOUS les bateaux. Alors que `vehicles.json` a des bateaux d'apparences différentes (cogue/caraque/galère/barge…). → à terme : art par bateau × 3 vues.
- **L'ENGIN (post-2026-06-29) est la RÉFÉRENCE du bon pattern** : `engin/defs/<id>.ts` (`EnginArtDef {id, front, profile, back}`) → registre `ENGIN_ARTS` → `composeEngin` résout par id (plus de regex/name-matcher, plus de `Record` à la main).
- **NE PAS fusionner engin↔navire maintenant** : fusionner rétrograderait l'engin au POC navire (1 vue). C'est le navire qui doit MONTER au modèle 3-vues. La mécanique « corps statique 3-vues » partagée (généralisation d'`EnginArtDef`/`ENGIN_ARTS`) s'extrait **quand le 2ᵉ vrai consommateur migre** (le navire), pas par anticipation. Cf. [[feedback-mutualiser-invariant-pas-juste-appel]], [[feedback-reutiliser-avant-reinventer]].

**Why** : le rig doit rendre chaque objet reconnaissable sous tous les angles iso, comme les créatures — le navire 1-vue/1-art-générique est une dette POC à combler, pas la norme.
**How to apply** : pour tout nouvel objet statique rig → art par id × 3 vues en `defs/` + registre (jamais inline générique ni name-matcher). Quand on migre le navire : per-bateau, 3 vues, et extraire alors la brique statique-3-vues commune. Cf. [[game-namematch-deleted]], [[game-creature-registry]], [[game-visual-direction]].
