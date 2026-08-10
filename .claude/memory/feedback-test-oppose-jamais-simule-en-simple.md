---
name: feedback-test-oppose-jamais-simule-en-simple
description: "Arbitrage user 2026-07-17 — un Test OPPOSÉ du RAW ne se présente JAMAIS comme un test simple avec le DR adverse caché en applier ; la machinerie d'opposition réelle existe et doit être utilisée (vécu jeux de taverne)."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6dda9f10-baee-4f9e-b534-2933d9905a34
  modified: 2026-08-04T21:23:30.653Z
---

Verbatim user (2026-07-17, à propos des jeux de taverne NADJ) : « Perso les jets opposés sont un
MENSONGE dans l'implémentation des règles rapides, car … on fait un test simple, on ne voit jamais
le test de l'adversaire en opposition, juste son nombre de DR dans une modale qui indique si on
gagne ou non … alors qu'on SAIT FAIRE DES JETS OPPOSÉS ! »

**Why:** l'audit de forme (fiche [[feedback-audit-modeling-shape-vs-raw-intent]]) s'applique aussi à
la PRÉSENTATION du jet : un « Test opposé » du RAW résolu en test simple héros + tirage adverse
inline dans l'applier post-commit garde peut-être les bonnes maths, mais ment sur la FORME — le
joueur ne voit jamais l'opposition. Or la machinerie existe : squelette de Test opposé avec `aT`
figé au meta et ré-opposé à chaque influence (`combat/triggeredTest.ts`), oppositions d'incantation
(`openCastOpposition`), `VsHeader`.

**How to apply:** tout Test que le RAW qualifie d'OPPOSÉ sur le chemin joueur se joue dans la
présentation d'opposition réelle (les deux jets visibles, ré-opposition sous influence) — jamais un
« simple + DR adverse en chiffre ». Le raccourci rencontré se corrige (vécu : tavernFlow, ticket
ouvert dans le même tour) et tout NOUVEAU flux opposé se câble d'emblée sur la vraie machinerie.
Sweep de classe : chercher les autres « opposé » résolus en simple-plus-tirage-caché.

**2e OCCURRENCE (2026-08-04, #1090 — Piétinement)** : `resolveTrample` côté héros = jet SIMPLE (défense
escamotée, sonde 4000 tirages : def CC10 ≡ CC90 à l'octet) alors que le RAW dit « Attaque … Compétence
Corps à corps » = Test opposé ; l'ennemi passait, lui, par le chemin opposé. La fiche seule n'a PAS
suffi — le sweep de classe n'avait pas été mécanisé. → La classe se MÉCANISE en garde structurelle
(DoD #1090) : inventaire des fonctions de résolution attaque-like, chacune route par la machinerie
opposée OU porte une justification RAW citée de sa simplicité. Corollaire : un recensement (registre
#1066) ne jure QUE ses axes mesurés — la fidélité de RÉSOLUTION est un axe à part, désormais lentille
obligatoire du tri #1070.
Lié : [[game-rollflow-canonical-system]], [[feedback-audit-modeling-shape-vs-raw-intent]], [[feedback-un-detecteur-ne-mesure-que-sa-couverture]].
