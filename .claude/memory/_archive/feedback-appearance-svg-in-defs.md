---
name: feedback-appearance-svg-in-defs
description: "L'apparence/le SVG d'un élément de design va dans defs/, jamais en dur ni via regex/label"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d10576e3-ad46-4ab0-aad1-e2c2f0028da3
---

Toute **apparence** d'élément de design (couleur, matériau, GÉOMÉTRIE/SVG de rendu) doit vivre dans un
registre **`defs/`** (comme terrain `swatch`/`gradient`, `BuildingDef.render`, props), consommée par TOUS
les renderers — jamais codée en dur dans un renderer, jamais choisie par **regex/label sur l'id** (ban
total du regex ; cf. migration label→id). Un même élément rendu par deux vues (iso `walls.ts` + POV
`geometry.ts`) partage UNE def : « tout SVG finit en defs/ ».

**Why:** l'user a un standard strict data-driven ; deviner l'apparence par `/pierre|bois/.test(id)` ou
hardcoder des hex dans le renderer = dette + divergence (deux rendus qui dérivent). Il l'a répété
plusieurs fois (« Regexp ? On a mis fin aux REGEXP », « tout ce qui est svg doit finir en defs/ »).

**How to apply:** avant de colorer/dessiner une entité, chercher/créer sa def (`structureAppearance(id)`,
`TerrainDef`, etc.) ; classer par CHAMP DONNÉE (`kind`/`fortified`/…), pas par pattern d'id. Nouveau type
de rendu ⇒ étendre la def + le registre `gen-registry.mjs`, pas un `if` dans le renderer. Cf.
[[game-pov-first-person-view]], [[game-label-id-migration-complete]], [[feedback-contenu-donnee-editeur-pas-code]].
