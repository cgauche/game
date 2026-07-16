---
name: feedback-editeur-ref-picker-coherent
description: "L'édition de références dans l'éditeur doit être UNE primitive cohérente (picker autocomplete par nom → stocke l'id) ; jamais « tape l'id » ou « tape le libellé exact »"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e636cc63-4e05-4723-bc40-1452e878c0af
---

L'utilisateur trouve **aberrant** que l'édition d'une référence (compétence/talent/sort/trait/qualité/possession) dans l'éditeur soit INCOHÉRENTE : « parfois autocomplete, parfois faut connaître l'id, parfois c'est le label ». Il veut **UNE** façon d'éditer une ref partout.

**Why:** un éditeur de contenu doit être prévisible — l'auteur choisit un NOM dans une liste cherchable, point. Devoir connaître un slug/id ou taper le libellé exact (et espérer que le parse marche) est une mauvaise UX et fragile.

**How to apply:** quand un écran d'éditeur édite une référence → réutiliser/monter la primitive **picker unique** (autocomplete/recherche par libellé d'affichage, **stocke l'id**, multilangue-safe), pas un champ texte à parser ni un `<datalist>` ni un id à taper. Les champs annexes (value d'une compétence, spec/arg d'un trait, count) = inputs adjacents, PAS encodés dans une chaîne tapée. Base existante : `RefField` (CodexEdit). Sites à converger : `StatblockEditor` (skills/talents/spells/traits), `GameOpEditor` (grantTrait/addTraits/refs de sort), `OptionalTraitsPicker`, `SpellsField`. Prolonge [[feedback-reutiliser-avant-reinventer]] + [[feedback-ecran-touche-audit-primitives]]. Cf. migration ids [[game-refs-ids-migration]].
