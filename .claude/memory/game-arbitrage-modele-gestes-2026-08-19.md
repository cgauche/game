---
name: game-arbitrage-modele-gestes-2026-08-19
description: "ARBITRAGE 2026-08-19 — modèle de gestes du combat révisé (supplante le « grid par défaut » du 2026-08-16) - clic-ennemi attaque À PORTÉE seulement, Course à ARMER, Marche seule peinte par défaut, refus VISIBLE, annulation GRATUITE"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3c1689ae-eeaa-4da2-a83f-c35ecef5c557
  modified: 2026-08-19T14:27:42.499Z
---

Arbitrage user 2026-08-19 (AskUserQuestion, instruit par recherche état de l'art 9 jeux — RT/XCOM/JA3 attaque-capacité, BG3 Dash explicite, grille = zones peintes, hors-max = refus net partout). Question user (verbatim) : « Rogue Trader demande a cliquer explicitement d'un l'attaque que tu souhaite faire pour attaquer, ce n'est jamais choisi automatiquement ? Par défaut seul la zone de déplacement est affiché, et BG3 demande a cliquer sur la course pour dépasser la zone de mouvement normal, ce n'est pas automatique ? »

1. **Clic-ennemi nu = attaque auto À PORTÉE seulement** ; hors portée = refus dit / sélection — le déplacement est un geste séparé.
2. **Course à ARMER (école BG3)** : clic-sol au-delà de la Marche = refus dit ; armer la case Course débloque la zone étendue.
3. **Marche seule peinte par défaut** ; la Course se peint à l'armement.
4. Lois : refus VISIBLE au point du geste (jamais au journal — invisible en combat), annulation GRATUITE par construction (contre-exemple Solasta), une intention armée ne bloque jamais les modes de ciblage.

**SUPPLANTE** le verbatim fondateur 2026-08-16 (« Ca ne change pas les actions par défaut sur le grid ») porté par `src/state/localIntent.ts:4-9` — texte intégral dans `docs/plans/2026-08-16-spec-hud-combat.md` § « ARBITRAGE 2026-08-19 » (commit ca1cf334). Voir [[game-arbitrage-hud-console-rt-2026-08-16]] pour le reste du chantier (géométrie immuable etc., toujours valides).
