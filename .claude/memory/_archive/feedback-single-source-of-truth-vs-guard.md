---
name: feedback-single-source-of-truth-vs-guard
description: "Avoir besoin d'un garde pour resynchroniser deux états = smell de conception ; collapser en UNE source de vérité"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f5261895-c4ee-47ae-9b86-839787e95117
---

Quand j'ai proposé un garde defense-in-depth pour « ré-héberger » une `pendingFumble` orpheline (soft-lock combat), l'utilisateur a coupé : « Qu'on ait besoin de faire ça, ça indique un problème dans notre fonctionnement, non ? ». Il a raison.

**Why:** un garde/heal qui resynchronise deux états = pansement. La vraie cause = **deux sources de vérité** pour une même chose, maintenues à la main sur N sites, donc désynchronisables. Ici : `pendingFumble` (donnée top-level) + l'étape de cascade `{jet:'fumble'}` (l'hôte visible) ; le « fold » avait unifié la MODALE mais pas l'ÉTAT → n'importe quel chemin fermant la cascade orphelinait `pendingFumble` → `combatGate` gelait le tour à jamais.

**How to apply:** avant d'ajouter un garde/guard/heal/watchdog qui « rattrape » une incohérence, demander : *pourquoi deux états peuvent-ils diverger ?* Collapser en UNE source de vérité (la donnée vit sur l'objet qui la porte déjà), supprimer le doublon ET son entrée de gate. Le bug devient structurellement impossible, pas seulement rattrapé. Fait ici : payload sur `CascadeStep.fumble` (comme `deviation`/`bladeTrap`/`knockdown`), suppression de `pendingFumble` + de son entrée dans `combatGate`. Prolonge [[feedback-reutiliser-avant-reinventer]] et [[feedback-zero-retrocompat-briques-solides]].

Corollaire fonctionnement : plusieurs sessions Claude éditant le MÊME working tree sur la MÊME zone (combat/cascade) = collisions réelles vues ce jour (combatFlow.ts changé sous l'Edit, 18 tests cast cassés par un refacto spellLabel //, EOL flippés par mon git stash). Pour un fix de race dans du code en cours de réécriture : coordonner ou attendre l'atterrissage.
