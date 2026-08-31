---
name: feedback-blame-dernier-toucheur-methode-fausse
description: "2026-08-31 : attribuer un artefact (export mort, bloc disparu) au DERNIER commit qui touche le fichier est une méthode FAUSSE — mesurer naissance→mort du consommateur, et suspecter l'OUTILLAGE avant le lot"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7fa03aff-afd5-481d-b04f-f8c0892b5ff1
  modified: 2026-08-31T13:48:21.820Z
---

Deux réfutations le même jour, même classe d'erreur (2026-08-31, mesures du juge de la session voisine) :
1. J'ai accusé le staging voisin d'avoir « avalé » un bloc committé — grep -c aux trois shas : le bloc était partout, mon diff mal lu (commit 61460daf1, record corrigé en a294b7a6b).
2. J'ai blâmé la migration skillId pour 4 exports morts via `git log -S` (dernier toucheur) — mesure nominative : 3 étaient NÉS morts des jours avant, le 4e révélé par un re-export antérieur à la vague. La cause racine était l'OUTILLAGE : knip `ignoreExportsUsedInFile` masque les morts à consommation interne puis ACCUSE le lot qui bouge le fichier (#1617).

**Why :** `git log -S` rend le dernier commit qui a TOUCHÉ la chaîne, pas celui qui a tué le consommateur ; et une garde à masque (baseline, ignore-flag) fait porter son retard au premier lot qui la réveille. Un blame rapide et faux coûte double : la fausse accusation au voisin, ET la vraie cause (outillage) non traitée.

**How to apply :**
1. Attribution d'un export/symbole mort : mesurer NAISSANCE (commit qui le crée) → MORT DU DERNIER CONSOMMATEUR (commit exact qui retire le dernier import/appel), jamais le dernier toucheur du fichier.
2. Avant d'accuser un lot : demander si la GARDE a un masque (baseline, ignoreExportsUsedInFile, tolérance) qui a pu retarder la détection — le déclencheur n'est pas le coupable.
3. Un blame qui accuse une AUTRE session se vérifie au grep sur les shas AVANT d'être énoncé — et se corrige au record (message de commit suivant) s'il est réfuté ; voir [[feedback-attribution-rouge-suite-sonde-arbre-committe]], [[feedback-verifier-les-claims-architecturaux-des-agents]].
