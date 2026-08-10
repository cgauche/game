---
name: feedback-i-suit-son-referent
description: "Convention UI utilisateur : l'affordance (i) se place APRÈS l'élément qu'elle référence, jamais avant — et ne doit jamais pouvoir s'orpheliner sur une autre ligne au repli."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 95f8c967-e150-40d7-aa35-90f866e88a3a
  modified: 2026-08-10T09:17:54.859Z
---

Verbatim utilisateur (2026-08-10, #1153) : « le (i) par convention est apres et non avant ceux a quoi il fait référence » — sur capture où l'ⓘ du palier de Difficulté, placé AVANT le texte, s'orphelinait en fin de ligne précédente (collé à la compétence, dont il n'est pas).

**Why :** un (i) placé avant son référent se rattache visuellement à ce qui précède (surtout au repli de ligne) — le lecteur attribue l'affordance au mauvais élément. La position code l'appartenance.

**How to apply :** toute affordance (i)/glyphe d'aide se pose APRÈS son référent, DANS le même déclencheur (même hit-target), avec anti-orphelin (le texte et son glyphe insécables au repli). Piège d'origine : la consigne « le i devait être devant la difficulté » désignait le PROPRIÉTAIRE (la Difficulté vs la compétence), pas la position — ne pas sur-lire une préposition comme une spec de layout. Lié : [[feedback-affordance-morte-signaler]], [[feedback-composer-primitives-jamais-markup-brut]].
