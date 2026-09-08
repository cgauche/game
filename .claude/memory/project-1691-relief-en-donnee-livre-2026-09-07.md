---
name: project-1691-relief-en-donnee-livre-2026-09-07
description: "#1691 LIVRÉ le 2026-09-07 (matière de relief en DONNÉE : terrains.json › matiere + scene.reliefDefaults, builder lecteur, bump de projet 7 → 8) — leçons : un champ EXIGÉ au schéma = bump de version + migration ; une entrée de donnée affirmée par cardinal dans des migrations datées ne meurt pas sans régime ; course de push avec le pair = préavis ferme sur #1679"
metadata:
  type: project
  originSessionId: 4407a64f-b0ad-4d3d-b30f-ffca252025d6
---

**#1691 livré (2026-09-07, wt-1624, push 056d287b8..d91e3b46b)** — premier des quatre descendants de #1686 absorbés (ordre : #1691 → #1692 → #1694 → #1693 ; #1686 reste OUVERT jusque-là). Forme cible (invariant v2 après juge de design, `node_modules/.cache/invariant-1691-v2.md` de la session) : `terrains.json › matiere` (`idDe('material','relief')`, exigé ⟺ `solidHeightM > 0`), `scene.reliefDefaults` EXIGÉ keyé par le vocabulaire ÉMIS des faces (`cliff`/`ramp`/`deck`/`pilier`), `floors.ts` lit (bloc plein → terrain, sinon → scène), `plan` par marqueur `vueDeDessus`, garde dérivée « aucun id de `materials.json` dans `builders/**` », sonde d'identité des ids de relief promue en test, sonde `FaceSurface` identique.

**Leçons (mesurées)** :
- **Un champ EXIGÉ au schéma de scène change la FORME du document de projet** : 29 rouges de la suite complète (projets de schéma antérieur + fixtures) → c'est un BUMP de version (`SCHEMA_PROJET` 7 → 8, `PROJECT_MIGRATIONS[7]`, la migration datée devient la dernière de la chaîne, `t2 bis` mesure le no-op sur l'état réel), jamais un relâchement. Le codeur avait vérifié « 66 scènes + 38 scénarios parsent » et oublié les DOCUMENTS antérieurs.
- **Une entrée de donnée affirmée par CARDINAL dans des migrations datées antérieures ne meurt pas** (`plafond` : `l1b-10c` labels et `1686-materials` relief 4/16 rougissent au rejeu, porte du pre-push) — la mort attend son émetteur ou un régime de rejeu tolérant aux morts postérieures ; dit à l'inventaire de #1686.
- **Une porte de migration posée sans câblage (`test:hooks` + allowlist `ecrivainsAtteints`) est une garde MORTE** — vérifier le câblage au rendu du codeur.
- **Le stock des slots a un angle mort déclaré** : un record à clés fixes (`reliefDefaults`) se projette sur ses sous-clés par `champDuPath`, jamais sur le champ porteur (précédent `props.json | light`) → ligne datée au stock + `DETTE_ADOPTION_MAX`, pas d'adoption au champ.
- **Course de push avec le pair** : gates série ~15 min contre des pushes toutes les ~20 min → 5 rebases pour un train ; demande FERME de créneau sur #1679 (30 min) avant de lancer les gates, et push immédiat après.
- Le garde de commit exige le nom d'archive de revue à DEUX segments (`revue-palier-<date>-<base>.md`) alors que `revuePalier.mjs:57` en produit trois — relayé (revue n°7, trouvaille 6). Un fichier de revue stagé non conforme bloque TOUS les shells (Bash, PowerShell, ctx_shell) : renommer par `ctx_execute(language="javascript")` + `renameSync`.

**Restes nommés (inventaires, aucun ticket neuf)** : #1463 (champs étrangers `terrains: 2`, angle mort des slots), #1686 (ids de matière en dur dans `catalog/buildings/defs/*.ts`, cinq replis `?? DEFAULT_ROOF_DEFAULTS`, `plafond` sans émetteur), #1689 (refus muet par composition `GameMenu.tsx:73,76` — revue n°7).

**Why:** reprendre #1692 sans relire les rendus ; ne pas refaire les erreurs de forme. **How to apply:** avant tout champ EXIGÉ au schéma de scène → bump + migration ; avant toute mort d'entrée de dataset → `git grep` de l'id dans `scripts/migrations/` ; avant les gates → créneau sur #1679. Liens : [[project-1690-terrains-json-etat-2026-09-06]], [[project-1686-materiaux-etat-2026-09-05]], [[user-arbitrages-2026-09-05-materiaux-1686]], [[feedback-test-jamais-un-cardinal-vivant-ni-un-magasin-partage]].
