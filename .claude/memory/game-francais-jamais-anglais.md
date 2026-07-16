---
name: game-francais-jamais-anglais
description: Le jeu est en français — ne JAMAIS parser/citer une source anglaise pour les règles ou stats.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5b5e1576-6e66-4371-b038-61f34984d882
---

Le jeu WFRP4 (Foundry/Game) est **100 % en français**. Toutes les règles, stats, noms de traits et de compétences viennent **exclusivement des sources FR**.

**Why:** L'utilisateur m'a repris pour avoir cité la version *anglaise* du scénario (`Enemy in Shadows / Mistaken Identity`) au lieu de la VF. La data du jeu est FR (CC/CT/F/E/I/Ag/Dex/Int/FM/Soc/B, et non WS/BS/S/T/…/W). Parser l'anglais introduit du vocabulaire et des valeurs qui ne correspondent pas à la donnée.

**How to apply:** Pour toute stat/règle, lire la source FR dans `Game/Source/` (cf. [[game-source-fr-campagne-custom]]). Les traits FR : « Arme (Épée) +7 », « À distance (Arbalète) +9 (60) », « Morsure +N », « Mutation (…) ». La donnée AUTHORÉE et CITABLE reste FR (verbatim recollable dans `Game/Source/`).

**EXCEPTION actée par l'user (2026-06-23) :** « en cas de question, regarde la VO ». Quand la source FR est AMBIGUË ou que le Marker a dérivé (cf. [[game-atlas-reanchor-epreuve]]), on PEUT consulter la VO pour DÉSAMBIGUÏSER l'intention de la règle. La VO de la Mer des Griffes = `Foundry/Source/Sea of Claws/` (parent). Cross-check de désambiguïsation ≠ citation : on n'authore/cite jamais la VO comme donnée du jeu, on s'en sert pour comprendre. (Ex. : « les bateaux ont-ils des emplacements d'arme ? » → VO « Boats and Boatbuilding » confirme le FR : pas de slots fixes, placement libre par côté limité par la Contenance + Sabords/Gun Ports en Amélioration.)
