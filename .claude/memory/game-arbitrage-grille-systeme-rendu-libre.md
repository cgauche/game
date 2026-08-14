---
name: game-arbitrage-grille-systeme-rendu-libre
description: "Arbitrage user 2026-08-14 : la grille est une simplification du SYSTÈME (combat) — le moteur graphique n'a pas à en hériter ; lumière/vue/immersion se rendent en continu."
metadata:
  type: project
---

**Arbitrage utilisateur (2026-08-14, verbatim, consigné à #1176)** : « Le jeu ne réfléchi pas par case normalement, c'est juste une facon pour nous de se simplifier la tache pour ce qui est de gérer les combats, mais ça reste du système de jeu, le moteur graphique lui n'a pas a sentir limiter par le cadriage. Biensur les murs sont sur des arretes, les personnages se déplacent de case en case, mais la lumiere, la vue, tous ces éléments d'immersion n'ont pas besoin d'en souffrir »

**Comment l'appliquer** : la grille reste la vérité du SYSTÈME (portées, murs sur arêtes, déplacement, LdV du moteur de règles). Mais tout RENDU d'immersion (brouillard/teinte de visibilité, lumière, ambiance) se présente en CONTINU — champ échantillonné par sommet, frontières fondues ; la « bavure » visuelle sur une case voisine est VOULUE, pas un défaut. Ne jamais justifier une quantification visuelle par « la règle est par case » : c'est le raisonnement que cet arbitrage interdit. Exception maintenue : la coupe d'étage/cutaway FRANCHE en vue top ([[game-arbitrage-vue-top-tactique-tabletop]] — lisibilité de plan, pas immersion).

Première application : G4 de l'audit des héritages SVG ([[game-audit-moteur-rendu-2026-08-09]], lot C6 de #1176) — teinte de visibilité par élément d'ancrage → champ continu par sommet.
