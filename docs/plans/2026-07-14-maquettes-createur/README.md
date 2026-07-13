# Maquettes RATIFIÉES — créateur de personnage, charte « Atelier du scribe » (2026-07-14)

Artefact DATÉ (politique `docs/plans/`) : à SUPPRIMER une fois la transposition #393
exécutée (git porte l'historique). Ratification utilisateur 2026-07-14 (verbatim : « Donc
je vais valider ca ») — l'étalon de STYLE des lots de transposition, pas de texte
(délégation : « Je ne demande pas de la fidélité sur le texte, mais au moins sur le style »).

## Contenu

- `planche-creator-FINALE.html` — les 10 écrans du créateur (autonome, fonts à lier ou
  ouvrir depuis le dossier Discord `Desktop/planches-warhammer/` pour la version inlinée).
- `design-system-atelier.html` — le kit UI (tokens, organismes, interdits, notes datées).
- `finale-mock0-race.png` … `finale-mock9-presentation.png` — captures 1600px de référence
  pour les juges vision des lots P1-P5 (cf. #393).
- `planche-compagnie.html` + `compagnie-mock0/1.png` — l'écran de SÉLECTION DE LA
  COMPAGNIE (hors créateur), conforme au kit v2. Décisions propres (2026-07-13) : la
  compagnie en COLONNE RICHE (jamais annulée — miniaturisée : le bouton groupe porte les
  portraits + « (X/4) ») ; candidats en tuiles-portraits ; présentation « Qui est-ce ? »
  du candidat élu ; même colonne de droite universelle que le créateur. Le code socle
  (sélection v4/v5, commits 3c486ded/7cfceda8) précède la peau Atelier — sa transposition
  est un lot de #371/#414, pas de #393.

## Écarts CONNUS où les arbitrages priment sur la maquette

1. **Talents/compétences « ou »** : la maquette rend du pointillé gris-sur-noir et des
   chaînes fusionnées — erreur répétée, arbitrage 2026-07-14 : chips SÉPARÉES codex-liées
   (comportement du créateur actuel, EntityChip/CodexRef) avec la peau Atelier.
2. Le bouton « Choisir cette carrière » n'existe pas (« Suivant fait deja ca »).
3. Les figurines de tuiles de la maquette sont des silhouettes génériques — le code
   utilise CharacterPreview (vrais rigs).
