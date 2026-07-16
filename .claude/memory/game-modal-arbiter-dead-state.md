---
name: game-modal-arbiter-dead-state
description: "L'arbitre de modales monte UNE modale par priorité ; une modale qui se masque selon un AUTRE pending = état mort (combat bloqué)"
metadata: 
  node_type: memory
  type: project
  originSessionId: f627b3e3-21fc-4839-9a41-b89b5beaec2d
---

`pickActiveModalKey` (`src/ui/ActiveModal.tsx`) ne monte QU'UNE modale de combat, la 1re par priorité. **Piège** : si la modale choisie rend `null` selon un AUTRE pending (plus bas dans l'ordre), l'arbitre ne « tombe » PAS sur la suivante → AUCUNE modale → partie figée.

Cas réel (2026-06-09, « ennemis ne jouent plus / Tour de l'ennemi bloqué ») : Frappe Mortelle. `cleaveAttack` pose `pendingAttack {cleave}` mais GARDE `pendingCleave` (il porte hitIds/count, relu par `maybeHeroCleave(wasChain)` — donc le vider casserait le BCC). `CleaveModal` se masque (`if (pa) return null`) pour laisser le jet d'enchaînement prendre la main. Avant l'arbitre (R2) toutes les modales étaient montées → `RollModal` s'affichait. Depuis l'arbitre, `pendingCleave` (prio 4) > `pendingAttack` (prio 19) → monte `CleaveModal` qui rend null → rien.

**Fix** : le prédicat de l'arbitre doit refléter la condition de rendu de la modale. `[!!s.pendingCleave && !s.pendingAttack, 'cleave']`. Couvert par `active-modal.test.ts` (`pendingCleave + pendingAttack → 'attack'`).

**How to apply** : en ajoutant une modale à l'arbitre, si son composant fait `return null` à cause d'un autre `pending`, encoder cette même condition dans le prédicat de `pickActiveModalKey`. Prolonge [[game-jet-modale-exhaustif]].
