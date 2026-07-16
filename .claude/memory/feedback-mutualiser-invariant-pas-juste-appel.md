---
name: feedback-mutualiser-invariant-pas-juste-appel
description: Mutualiser quand un INVARIANT multi-étapes se répète (pas juste un appel) — mesurer par « un appelant peut-il le violer ? »
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5b6e3f22-7155-4d2e-bf85-94656ba3d0fa
---

Quand un même invariant **en plusieurs temps** se répète sur N sites, le mutualiser dans UNE primitive qui rend l'invariant **infalsifiable** — même si chaque appel individuel « ressemble à de la simple réutilisation » d'un primitif existant.

Cas concret (#80, mutualisation crit-location) : la règle « tirer la loc fraîche UNE fois + la passer en `chosenCritLocation` sinon `applyCriticalToTarget` re-tire en interne → **double tirage** » était répétée à la main sur 5 sites (mêlée/déviation/opposé/tir-magie).

**Why:** j'ai dismissé la mutualisation comme « cérémonie » (« le tirage est déjà à une source = `critLocationRoll`, l'appeler 3× c'est de la réutilisation »). L'user a insisté. Puis j'ai **cassé l'invariant moi-même** (oublié `chosenCritLocation` → déflecteur/révélation à une loc, table de Critique à une autre). La preuve que ce n'était PAS de la cérémonie : un appelant pouvait le violer **silencieusement**.

**How to apply:** mesurer la duplication par « un appelant peut-il violer l'invariant ? », PAS par le nombre de lignes. Si oui → extraire une primitive ET retirer le footgun **à la source** (ici : `applyCriticalToTarget` ne re-tire plus rien, son param `location` EST la loc résolue ; `critWoundLocation(rng, bodyShape?, override?)` = source unique de LDB 18 l.53). Le double tirage devient structurellement impossible. Committé 7b5cff15. Cf. [[feedback-reutiliser-avant-reinventer]] [[feedback-effet-existant-general-parametrable]] [[feedback-orchestrator-verify-delete-redo]].
