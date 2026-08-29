---
name: user-arbitrage-barre-materialisee-et-sans-pages
description: "Arbitrages utilisateur 2026-08-24 (AskUserQuestion) : la grille de capacités n'a PAS de pages I/II/III (2×6 fixe, l'exhaustif = écran de capacités) ; le pré-remplissage de la barre se MATÉRIALISE façon BG3/WoW (écrit une fois dans Combatant.barre, une capacité nouvelle s'ajoute à la première case libre, retirer laisse un trou, RIEN ne glisse jamais) — remplace la sémantique d'écoulement livrée au lot A1"
metadata: 
  node_type: memory
  type: user
  originSessionId: 3c1689ae-eeaa-4da2-a83f-c35ecef5c557
  modified: 2026-08-24T09:58:51.764Z
---

Deux options retenues le 2026-08-24 (assertions validées via AskUserQuestion) :

1. **« Pas de pages »** : « La grille reste 2×6 fixe ; l'exhaustivité passe par l'écran de capacités ; tes 12 épinglages suffisent par héros. Conforme RT. » — clôt la question née de l'annotation de planche (spec :214 vs :256) ; les onglets I/II/III ne se construisent pas.

2. **« Matérialiser (BG3/WoW) »** : « La barre déduite s'écrit une fois dans le héros ; une capacité nouvelle s'ajoute à la première case libre ; retirer laisse un trou ; RIEN ne glisse jamais — le plus proche de "la position s'apprend" (RT). » — remplace l'écoulement du lot A1 (`resoudreDisposition` sur déduit glissant). Design de mise en œuvre proposé par le juge passe 2 : au premier rendu de la console pour un porteur, écrire le pré-remplissage déduit dans `Combatant.barre` via `poserDansBarre` ; ensuite une entrée NEUVE de l'offre s'APPEND au premier rang libre ; une entrée qui QUITTE l'offre laisse sa case dessinée fermée avec sa raison (jamais un trou muet).

Chantier : [[project-personnalisation-console-invariant-juge]].
