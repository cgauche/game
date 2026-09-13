---
name: game-modal-arbiter-dead-state
description: "L'arbitre ne monte QU'UNE modale ; une modale qui se masque selon un AUTRE pending crée un état mort"
metadata:
  node_type: memory
  type: project
---

`pickActiveModalKey` (`src/state/modalArbiter.ts`) monte la PREMIÈRE entrée de `MODAL_DEFS` dont `when` est vrai — il ne « tombe » jamais sur la suivante. Si le composant choisi rend `null` à cause d'un autre `pending`, aucune modale ne s'affiche et la partie fige.

**Why:** l'arbitre choisit sur l'ÉTAT, pas sur ce que le composant décide de rendre.

**How to apply:** si un composant fait `return null` à cause d'un autre `pending`, encoder la MÊME condition dans son prédicat `when` ; un `pending` qui n'est PAS rendu par une modale (ciblage sur la carte, écran dédié) va au registre `HORS_MODAL`, jamais dans `MODAL_DEFS`.
