---
name: game-modal-arbiter-dead-state
description: "L'arbitre de modales monte UNE modale par priorité ; une modale qui se masque selon un AUTRE pending = état mort (combat bloqué)"
metadata: 
  node_type: memory
  type: project
  originSessionId: f627b3e3-21fc-4839-9a41-b89b5beaec2d
---

`pickActiveModalKey` (défini dans `src/state/modalArbiter.ts`, ré-exporté par `src/ui/ActiveModal.tsx`) ne monte QU'UNE modale, la 1re entrée de `MODAL_DEFS` dont le prédicat `when` est vrai (ordre du tableau = priorité). **Piège** : si la modale choisie rend `null` selon un AUTRE pending (plus bas dans l'ordre), l'arbitre ne « tombe » PAS sur la suivante → AUCUNE modale → partie figée. Vécu 2026-06-09 sur la Frappe Mortelle (« ennemis ne jouent plus / Tour de l'ennemi bloqué »), quand un `pending` porteur de données coexistait avec le `pending` du jet réel.

**Deux issues, selon ce que le `pending` porte vraiment :**
- Il a bien SA modale, mais elle se masque quand un autre `pending` est posé → le prédicat `when` de son entrée doit encoder la MÊME condition (`!!s.pendingX && !s.pendingY`).
- Il n'est PAS rendu par une modale (ciblage sur la carte, écran dédié) → il n'a rien à faire dans `MODAL_DEFS` : son entrée va au registre **`HORS_MODAL`** (`pendingKey` + `owner`), et `pickActiveModalKey` rend `null` par CONSTRUCTION. C'est le cas de `pendingCleave`/`pendingDualStrike` (Frappe Mortelle / 2ᵉ frappe = ciblage `TargetPrompt`) ; le jet qui suit est l'étape `jet:'attack'` de la cascade `combat`. Gardé par `src/ui/active-modal.test.ts`.

**Complétude typée** : `MODAL_DEFS.covers` ∪ `HORS_MODAL` doit reproduire EXACTEMENT `PendingKey` — un `pending*` sans owner déclaré ne compile pas. Un `pending` qui coexiste avec l'étape d'une cascade se déclare dans les `covers` de l'entrée `cascade` (porteur de données), pas en entrée propre.

**How to apply** : en ajoutant une modale à l'arbitre, si son composant fait `return null` à cause d'un autre `pending`, encoder cette même condition dans le prédicat de `pickActiveModalKey`. Prolonge [[game-jet-modale-exhaustif]].
