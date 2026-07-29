---
name: feedback-socle-resout-specs-adressent
description: "Le SOCLE résout, les specs ADRESSENT — si une fabrique délègue la logique à chaque spec, modifier le socle ne profite à personne ; l'utilisateur l'a attrapé après 3 passes de juge"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-07-29T10:27:33.177Z
---

Vécu 2026-07-29 (#939, dés fixés) : la fabrique `makeRollFlow` déléguait la résolution du dé forcé au `resolve(forced)` de CHAQUE spec. Résultat : le « picker universel » posé AU SOCLE n'a réellement servi que les 16 flux à lentille ; les 20 autres offraient une réussite gratuite (leurs résolveurs ignoraient `forced.roll`). Trois passes de juge ont trouvé les trous un à un — et MA correction (« branche `forced.fixed` ~4 lignes × 20 flux ») recopiait vingt fois ce que le socle devait faire une fois.

Citation utilisateur (verbatim) : « Moi qui pensais que modifier le socle permettait d'assurer que tout le monde profite de cette modification »

**Why:** une fabrique dont les specs portent de la LOGIQUE (et pas seulement de l'ADRESSAGE) n'est pas un socle — c'est un gabarit de copies. Chaque évolution transversale exige alors N retouches, chacune oubliable, et les gardes ne voient que les flux qu'on pense à leur ouvrir.

**How to apply:**
- Répartition canonique : le SOCLE possède la RÉSOLUTION (évaluation, marquage, planchers — politiques paramétrées par flags) ; la spec ne déclare que l'ACCESSEUR (où vivent `{roll, target}`/le résultat dans SON pending) et ses paramètres de politique.
- Signal d'alarme : une consigne « ajoute la même branche dans N specs » = le socle a un trou — remonter la branche AU socle et réduire les N gestes à N déclarations d'accesseur.
- Critère d'acceptation d'un vrai socle : le flux N+1 obtient TOUT (affordance, évaluation, marquage) avec une déclaration d'une ligne ; une évolution du socle profite aux N sans toucher une spec.
- Corollaire garde : une garde de socle s'exécute sur une FIXTURE OUVERTE de chaque flux (un slot fermé = un no-op vert — la garde vacueuse de cette vague passait 30/30 avec le trou greffé).

Liens : [[feedback-mutualiser-invariant-pas-juste-appel]], [[feedback-effet-existant-general-parametrable]], [[game-rollflow-canonical-system]].
