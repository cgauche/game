---
name: feedback-ecran-neuf-maquette-validee-avant-code
description: "Règle dure (2026-08-24, écran de capacités rejeté deux fois) : AUCUN écran NEUF ne se code avant qu'une MAQUETTE (image) ait été validée par l'utilisateur — une spec « PRÊT » sur les primitives ne valide pas le RENDU ; itérer du code sur du goût non validé brûle l'usage pour rien"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3c1689ae-eeaa-4da2-a83f-c35ecef5c557
  modified: 2026-08-24T19:03:07.010Z
---

Verbatims utilisateur (2026-08-24, écran de capacités lot A2) : « Je n'ai jamais vu un écran des capacités aussi moche de ma vie » puis, après une refonte en tuiles décidée par moi : « cet écran de capacité c'est de la pure merde. Arrete toi. […] qui a pu valider ce "truc" » et « Ca me désole d'avoir perdu autant d'utilisation de claude pour ca ».

**Why :** la spec HUD marquait la Zone 6 « PRÊT » — mais PRÊT portait sur le CONTRAT (primitives, gestes, données), jamais sur le RENDU. Personne n'avait validé une image. J'ai enchaîné codeur → juges → recettes → refonte (4 passes, ~1,5M tokens) sur un habillage que l'utilisateur n'avait jamais vu. [[feedback-ecran-de-gout-validation-user-avant-commit]] protégeait main (rien n'a été fusionné) mais pas l'USAGE : tenir la fusion ne suffit pas, c'est le CODE qu'il ne fallait pas écrire avant validation.

**How to apply :** pour tout écran NEUF (ou refonte visuelle d'un écran existant) : (1) produire d'abord une MAQUETTE — capture d'une composition statique, planche, ou référence annotée d'un jeu que l'utilisateur aime — et la faire VALIDER par lui (AskUserQuestion avec l'image envoyée, ou attendre son retour) ; (2) seulement ensuite briefer un codeur, la maquette validée devenant le contrat de rendu ; (3) une spec « PRÊT » ne dispense jamais de ce passage — elle fige le mécanisme, pas le goût ; (4) au rejet d'un rendu, NE PAS improviser une refonte de ma propre initiative : revenir à l'étape maquette. L'écran A2 (branche `worktree-agent-ecran`, non fusionnée) garde sa mécanique valide — seul l'habillage est à refaire depuis une référence fournie par l'utilisateur.
