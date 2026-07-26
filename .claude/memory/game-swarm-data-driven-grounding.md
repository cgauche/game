---
name: game-swarm-data-driven-grounding
description: "Nuées rendues par espèce (SWARM_FORMS) + ancrage au sol ; QC tokens à l'échelle JEU, pas en zoom"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7fda4d63-abe3-41d4-9a6d-e37d4b955a9e
---

Les nuées (trait `nuee` → plan `swarm`) sont rendues data-driven par `appearance.species` :
`src/gameIso/rig/swarm/forms.ts` = `SWARM_FORMS` (rats/marcassins/araignees/noctecorbes/
snotlings/nurglings/squigs/zombies), Record keyé par id de FORME (pattern `FISH_SPECIES`,
zéro if-par-nom) ; `swarmFormOf(species)` = repli par `defById(species)?.plan`. `composeSwarm.ts`
`resolveSwarm` consomme l'espèce ; `swarmSvg` exporté pour QC/galeries.

**Avant (juin 2026) : bug majeur** — `resolveSwarm` ignorait l'espèce (toutes les nuées = même
amas brun) ET l'amas FLOTTAIT au-dessus de la tuile → lecture « vol de mouches » (retour user).
Corrigé : amas TERRESTRE descendu au sol (SPOTS y bas, rangée avant au niveau des pieds ~y150
local) + **ombre portée** ; `SPOTS_AERIAL` (dispersé, sans ombre) pour les nuées VOLANTES
(Noctecorbes — flotter EST correct pour un vol d'oiseaux). `bodyPlan` : nuée non typée → `''`
→ `DEFAULT_FORM` (PAS `speciesNames()[0]` ; `speciesNames()` alimente le picker éditeur).

**Leçon QC transverse** : QC les tokens à l'ÉCHELLE RÉELLE DU JEU (~80-110px, viewBox token
`0 0 120 150`, pieds au sol ~y145), **pas seulement en zoom** — un rendu correct à 600px peut
être illisible et/ou mal ancré (flottant) au scale réel. `scripts/qc/render-creature.mts` rend
à 620px (zoom) et ne gère QUE les non-bipèdes. Cf. [[game-qc-reconnaissabilite]],
[[game-creature-registry]].
