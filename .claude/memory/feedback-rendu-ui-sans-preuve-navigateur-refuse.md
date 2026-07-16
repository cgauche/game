---
name: feedback-rendu-ui-sans-preuve-navigateur-refuse
description: "Tout rendu UI d'agent SANS preuve navigateur produite par l'agent lui-même = REFUSÉ — les codeurs ONT les moyens headless (Bash + playwright-core du repo + patrons scratchpad verify-*.mjs)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: adfd4529-35c1-4ae9-85da-f959f7971274
---

2026-07-14, deux livraisons UI le même jour jamais affichées par personne avant l'utilisateur :
la scène de dés #396 (« Y'a aucun jet de dé, c'est trucs svg qui tourne de droite a gauche...
sur le premier jet on n'affiche pas le résultat ») et la galerie #412 (« Une erreur d'affichage
est survenue »). Les deux codeurs avaient rendu « portes vertes » (tsc + vitest) en se déclarant
« sans outils navigateur ».

**Why:** tsc + vitest ne MONTENT pas un écran : un crash au rendu réel, une animation ratée, un
résultat masqué passent toutes les portes textuelles. « Je n'ai pas d'outils browser » est FAUX
pour un codeur : Bash + `node_modules/playwright-core` + les patrons du scratchpad
(`verify-*.mjs`, `shot*.mjs`, monkey-patch setTimeout pour figer une animation) suffisent à
ouvrir l'app, dérouler un flux et capturer.

**How to apply:** tout brief de codeur UI exige la preuve headless PRODUITE PAR LE CODEUR
(captures nommées au scratchpad, console lue) — « un rendu sans captures = rendu refusé » ;
un rendu qui revient sans = recalage immédiat, pas de passe à l'orchestrateur ni au recetteur
pour compenser. Le recetteur reste la passe JOUEUR (ressenti, frictions), pas le filet des
codeurs. Complète [[feedback-ecran-de-gout-validation-user-avant-commit.md]] et la garde
« exister ne suffit pas, RENDRE est le contrat » (smoke-test de montage par spécimen, #412).
