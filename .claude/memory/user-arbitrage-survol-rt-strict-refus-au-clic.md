---
name: user-arbitrage-survol-rt-strict-refus-au-clic
description: "Le survol d'une cible valide montre la carte de jet ; hors d'atteinte ou case non peinte, il ne montre RIEN — le refus se dit au clic"
metadata:
  type: user
---

**Verbatim (2026-08-24)** : « Dans RT, mettre sa souris sur un ennemi ou une case hors porté ca n'affiche rien de particulier »

**Why :** le survol n'est pas un geste ; un refus annoncé au survol bruite la grille et invente un comportement absent de l'interface cible.
**How to apply :** cible valide à portée d'arme → carte de jet au pion (nom, valeur à battre, dégâts), sans verbe de manœuvre ; cible invalide ou case non peinte → rien au survol, le refus se rend AU CLIC par le mécanisme de refus existant ; une manœuvre comme la Charge s'ARME, elle ne se propose pas au passage du curseur.
