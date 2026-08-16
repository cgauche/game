---
name: feedback-question-viciee-arbitrage-nul
description: "Feedback user 2026-08-16 : un arbitrage obtenu par une question VICIÉE est NUL — ne jamais ré-arbitrer ce que le programme a déjà tranché, jamais d'option recommandée CONTRE le programme, toujours nommer le PÉRIMÈTRE de la question."
metadata:
  type: feedback
---

**Verbatim (2026-08-16, annulation de l'arbitrage caméra #1289)** : « Alors j'ai du mal comprendre la question sur les rotation en 4 diagonales. A l'epoque on parlait de la vue du dessus, et tu m'as poser cette question alors qu'un arbitrage existait deja. J'ai pris ton choix recommandé et c'était une grave erreur »

**Why** : la question AskUserQuestion du 2026-08-12 (« 4 vues diagonales seulement ? ») cumulait trois vices — (1) elle RE-ARBITRAIT un point déjà écrit au programme (#1176 Phase 3 : « rotation/zoom continus au jeu, les crans deviennent des aimants ») sans le rappeler ; (2) son périmètre était ambigu (l'utilisateur la croyait scoped à la vue du dessus, elle s'appliquait à toute la caméra) ; (3) l'option recommandée contredisait le programme. Résultat : l'utilisateur a suivi la recommandation, le moteur a livré un verrou à 90° au lieu de la rotation continue promise, et l'erreur n'a été vue que quand il a joué. Ma mémoire avait ensuite fossilisé cet arbitrage vicié en doctrine, servie avec assurance (« ce n'est pas un bug — c'est ton propre arbitrage »).

**How to apply** : AVANT toute AskUserQuestion d'arbitrage — (1) vérifier si le programme/ticket/un arbitrage antérieur tranche déjà : si oui, ne pas re-poser ; si la question veut RÉVISER l'existant, le DIRE dans son texte (« le programme dit X, veux-tu le réviser ? ») ; (2) le PÉRIMÈTRE de la question est nommé explicitement (quelle vue, quel écran, quel mode) ; (3) une option recommandée ne contredit jamais le programme sans porter cette contradiction en toutes lettres. Un arbitrage dont la question était viciée est NUL — on l'annule au ticket avec le verbatim, on ne le défend pas. S'articule avec [[feedback-option-askuser-porte-une-assertion]] et [[feedback-verbatim-au-ticket-decision-au-code]].
